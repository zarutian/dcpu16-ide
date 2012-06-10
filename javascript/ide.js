var listing;
var emulator;
var editor;
var _debugger;
var LINE_HEIGHT = 14;

$(document).ready(function(){	
	init();

});

function init() {
	$("#assemble_button").button({ icons: { primary: "ui-icon-link" } });
	$("#debug_button").button({ icons: { primary: "ui-icon-radio-on" } });
	
	$("#run_button").button({ icons: { primary: "ui-icon-play" } }).hide();
	$("#step_button").button({ icons: { primary: "ui-icon-arrowreturnthick-1-e" } }).hide();
	$("#pause_button").button({ icons: { primary: "ui-icon-pause" } }).hide();
	$("#stop_button").button({ icons: { primary: "ui-icon-stop" } }).hide();
	$("#reset_button").button({ icons: { primary: "ui-icon-arrowrefresh-1-s" } }).hide();
	$("#about_button").button({ icons: { primary: "ui-icon-help" } });
	
	$("#about_dialog").dialog({ 
		modal: true, 
		autoOpen: false, 
		resizable: false,
		minWidth: 350,
		buttons: { "Ok": function() { $(this).dialog("close"); } } 
	});
	
	$("#listing").scroll(updateDebuggerLine);
	$("#memory_container").scroll(updateMemoryWindow);
	
	$(".register-memory-value").click(function() { 
		gotoMemoryLocation(parseInt($(this).html()));
	});
	

	editor = ace.edit("editor");
	editor.setTheme("ace/theme/monokai");
	var DCPU16Mode = require("ace/mode/dcpu16").Mode;
	editor.getSession().setMode(new DCPU16Mode());
	editor.setHighlightActiveLine(false);
	editor.resize();
	editor.getSession().setUseSoftTabs(true);
	editor.getSession().on('change', function() { 
		assemble();
	});
	/*
	editor.on("guttermousedown", function(e){
		console.log(e);
		var target = e.domEvent.target;
		if (target.className.indexOf("ace_gutter-cell") == -1)
			return;
		if (!editor.isFocused())
			return;
		if (e.clientX > 25 + target.getBoundingClientRect().left)
			return;

		var row = e.getDocumentPosition().row
		e.editor.session.setBreakpoint(row)
		e.stop()
	});
	*/
	
	emulator = new Emulator();
	emulator.async = true;
	emulator.verbose = false;
	emulator.paused = true;
	var m = new Monitor(emulator);
	document.getElementById("monitor").appendChild(m.getDOMElement());
	
	emulator.devices.push(m);
	emulator.devices.push(new Keyboard(emulator));
	emulator.devices.push(new Clock(emulator));
	
	_debugger = new Debugger(emulator);
	_debugger.onStep = function(location) {
		updateDebugger(location);
	};
	_debugger.onPaused = function(location) {
		updateDebugger(location);
	};
	_debugger.onInstruction = function(location) {
		
	}
	
	setInterval(realtimeUpdate, 50);
	
	
	$.ajax({
		url: 			"/programs/diagnostics.asm",
		context:		this,
		dataType: 		"text",
		success: 		function(data) { 
			editor.getSession().setValue(data);
		}
	});
	
	
	//$("#source-dialog").resizable( { autoHide: true, handles: "s" });
	//$("#assembly-dialog").resizable( { autoHide: true, handles: "n" });
}

function assemble() {
	var tokenized = Tokenizer.tokenize(editor.getSession().getValue());
	listing = Assembler.compile(tokenized.lines);
	
	var errors = (new Array()).concat(tokenized.errors, listing.errors);
	
	//$("#assembly").html(listing.htmlFormat());
	
	if(errors.length == 0) {
		$("#assembly").html("OK");
		$("#assembly").css("background", "none");
	}
	else {
		$("#assembly").css("background", "#bc3329");
		var str = "";
		for(var i = 0; i < errors.length; i++) {
			str += "<div onclick='gotoLine("+errors[i].line+")' style='padding: 4px; margin-bottom: 3px; cursor: pointer;'>";
			str += "Line " + errors[i].line + ": ";
			str += errors[i].message;
			str += "</div>";
		}
		$("#assembly").html(str);
	}
	
	$("#output").html(listing.bytecodeText());
}

function gotoLine(line) {
	editor.gotoLine(line);
	editor.focus();
}

function startDebugger() {
	$("#assemble_button").hide();
	$("#debug_button").hide();

	$("#run_button").show();
	$("#step_button").show();
	$("#pause_button").show();
	$("#stop_button").show();
	$("#reset_button").show();
	
	$("#listing").find(".offset").unbind();
	$("#listing").html(listing.htmlFormat());
	$("#listing").find(".offset").click(function(evt) {
		var lineNumber = parseInt(this.id.substr("offset_line_".length));
		console.log("Breakpoint on " + lineNumber);
		
		// only allow breakpoints on lines that have actual commands
		if(listing.lines[lineNumber].bytecode.length > 0) {
			$(this).toggleClass("breakpoint");
			_debugger.toggleBreakpoint(parseInt($(this).text()), lineNumber);
		}
	});
	
	for(var bp in _debugger.breakpoints) {
		$("#offset_line_"+_debugger.breakpoints[bp]).addClass("breakpoint");
	}
	
	$("#editing_windows").hide();
	$("#debugging_windows").show();
	
	emulator.reboot();
	emulator.paused = true;
	emulator.run(listing.bytecode());
	updateRegisterWindow();
}

function stopDebugger() {
	emulator.reboot();

	$("#assemble_button").show();
	$("#debug_button").show();

	$("#run_button").hide();
	$("#step_button").hide();
	$("#pause_button").hide();
	$("#stop_button").hide();
	$("#reset_button").hide();
	
	$("#editing_windows").show();
	$("#debugging_windows").hide();
}

function pauseDebugger() {
	_debugger.pause();
}

function run() {
	_debugger.run();
	updateDebugger();
}

function step() {
	_debugger.step();
}

function reset() {
	emulator.reboot();
	emulator.paused = true;
	emulator.run(listing.bytecode());
}


function updateDebugger() {
	//console.log("updateDebugger");
	if(emulator.paused) {
		$("#debugger_line").show();
		
		ensureDebuggerLineVisible();
		updateDebuggerLine();
		updateRegisterWindow();
		updateMemoryWindow();
		updateCycles();
		
		$("#pause_button").hide();
		$("#step_button").show();
		$("#run_button").show();
	}
	else {
		//$("#debugger_line").hide();
		$("#pause_button").show();
		$("#step_button").hide();
		$("#run_button").hide();
	}
}

function realtimeUpdate() {
	if(!listing)  return;
	if(emulator.paused) return;
		
	updateDebuggerLine();
	updateRegisterWindow();
	updateMemoryWindow();
	updateCycles();
}

function calculateDebuggerLine() {
	// find line from memory offset
	var location = emulator.PC.get();
	var line = 0;
	for(line = 0; line < listing.lines.length; line++) {
		if(listing.lines[line].offset >= location) {
			location = listing.lines[line].offset;
			break;
		}
	}
	// skip lines that are noops
	while(line < listing.lines.length && listing.lines[line].offset == location) {
		line++;
	}
	line--;
	
	return line;
}

function getDebuggerLineTop(line) {
	return line*LINE_HEIGHT + $("#listing").position().top + 2;
}

function updateDebuggerLine() {
	var top = getDebuggerLineTop(calculateDebuggerLine()) - $("#listing").scrollTop();
	$("#debugger_line").css("top", top + "px");
}

function ensureDebuggerLineVisible() {
	var top = getDebuggerLineTop(calculateDebuggerLine());
	//console.log("ensureDebuggerLineVisible | current: " + $("#listing").scrollTop() + " | dest: " + top);
	if(top > $("#listing").scrollTop() + $("#listing").height() - LINE_HEIGHT || top < $("#listing").scrollTop()) {
		$("#listing").scrollTop(Math.max(top - $("#listing").height()/2, 0));
	}
}


function updateRegisterWindow() {
	for(var reg in emulator.Registers) {
		var val = Utils.hex2(emulator.Registers[reg].get());
		var memoryVal = Utils.hex2(emulator.RAM[emulator.Registers[reg].get()] || 0);
		
		var div = $("#register-" + reg).find(".register-value");
		if(div.html() != val) {
			div.addClass("changed");
			div.html(val);
		}
		else
			div.removeClass("changed");
			
		div = $("#register-" + reg).find(".register-memory-value");
		if(div.html() != memoryVal) {
			div.addClass("changed");
			div.html(memoryVal);
		}
		else
			div.removeClass("changed");
	}
}

function updateMemoryWindow() {
	
	var startOffset = Math.floor($("#memory_container").scrollTop() / LINE_HEIGHT) * 8;
	startOffset = Math.min(startOffset, 0xffb0);
	
	var memHtml = "";
	for(var i = 0; i < 10; i++) {
		memHtml += "<div class=\"memory_offset\">" + Utils.hex2(startOffset + i*8) + "</div>";
		memHtml += "<div class=\"memory_line\">"
		for(var j = 0; j < 8; j++) {
			memHtml += Utils.hex2(emulator.RAM[startOffset + i*8 + j] || 0) + " ";
		}
		memHtml += "</div><div class=\"clear\"></div>";
	}
	$("#memory").html(memHtml);
	$("#memory").css("top", ($("#memory_container").scrollTop() + 4) + "px");
}

function gotoMemoryLocation(location) {
	$("#memory_container").scrollTop(Math.floor(location / 8) * LINE_HEIGHT);
	updateMemoryWindow();
}

lastCycleUpdate = { time: 0, cycle: 0 };
function updateCycles() {
	var val = "";
	
	if(emulator.CPU_CYCLE > 0) {
		val = emulator.CPU_CYCLE;
		if(!emulator.paused) {
			var now = (new Date()).getTime();
			var speed = (emulator.CPU_CYCLE - lastCycleUpdate.cycle) / (now - lastCycleUpdate.time);
			lastCycleUpdate.time = now;
			lastCycleUpdate.cycle = emulator.CPU_CYCLE;
			val = Math.round(speed) + " MHz | " + val;
		}
	}
	
	$("#cycles").html(val);
}

function about() {
	$("#about_dialog").dialog("open");
	document.activeElement.blur();
}