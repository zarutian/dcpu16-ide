// to be used in dcpu16-ide by dangermccann adapted and extended by Zarutian

function SGST(_emulator) {
  this.id = 0x53475354;
  this.version = 0x0002;
  this.manufacturer = 0x5A52544E;
  this.emulator = _emulator;
  
  this.zoom = 2;
  this.exMem1 = null;
  this.exMem2 = null;
  this.exMem3 = null;
  this.exMem4 = null;
  
  this.mode = 0x0000;
  this.redrawFreq = 25; // in Hz
  this.interuptMessage = 0x0000;
  this.interuptOnPixelNr = 0x0000;
  this.registers = {}
  this.registers.r1 = 0x0000; // framebuffer slotSel or intensitySlotSel or intensity depending on mode
  this.registers.r2 = 0x0000; // framebuffer start or   redSlotSel depending on mode
  this.registers.r3 = 0x0000; // palette slotSel or     greenSlotSel depending on mode
  this.registers.r4 = 0x0000; // palette startAddr or   blueSlotSel depending on mode
  this.registers.r5 = 0x0000; // inensity startAddrs ignored in modes 0x0-0x6
  this.registers.r6 = 0x0000; // red startAddrs ignored in modes 0x0-0x5
  this.registers.r7 = 0x0000; // green startAddrs ignored in modes 0x0-0x5
  this.registers.r8 = 0x0000; // blue startAddrs ignored in modes 0x0-0x5
  
  var _this = this;
  this.canvas = document.createElement("canvas");
  this.canvas.width  = this.zoom * 256;
  this.canvas.height = this.zoom * 256;
  this.canvas.style.backgroundColor = "#777777";
  this.canvas.className = "SGST";
  document.body.appendChild(this.canvas);
  this.context = this.canvas.getContext("2d");
}
SGST.prototype.init = function() {
  this.context.scale(this.zoom, this.zoom);
  this.changeModeOrFrequency();
}

SGST.prototype.interrupt = function() {
  var aVal = this.emulator.Registers.A.get();
  var bVal = this.emulator.Registers.B.get();
  var cVal = this.emulator.Registers.C.get();
  var xVal = this.emulator.Registers.X.get();
  var yVal = this.emulator.Registers.Y.get();
  switch(aVal) {
    case 0x0001:
      this.mode = bVal;
      this.changeModeOrFrequency();
      break;
    case 0x0002:
      this.registers.r1 = bVal;
      this.registers.r2 = cVal;
      this.registers.r3 = xVal;
      this.registers.r4 = yVal;
      break;
    case 0x0003:
      this.registers.r5 = bVal;
      this.registers.r6 = cVal;
      this.registers.r7 = xVal;
      this.registers.r8 = yVal;
      break;
    case 0x0004:
      if (bVal == 0x0000) { bVal = 100; }
      this.redrawFrequency = bVal;
      this.changeModeOrFrequency();
      break;
    case 0x0005:
      this.interuptMessage = bVal;
      this.interuptOnPixelNr = cVal;
      break;
  }
}
SGST.prototype.redraw = function () {
  this.context.fillStyle = "black";
  this.context.fillRect(0, 0, 256, 256); 
  if (this.mode == 0x0000) { return; }
  var pixelNr = 0x0000;
  for (var y = 0; y < 256; y += 1) {
    for (var x = 0; x < 256; x += 1) {
      this.context.fillStyle = this.getPixelColour(x, y);
      this.fillRect(x, y, 1, 1);
      pixelNr += 1;
    }
  }
}
SGST.prototype.getPixelColour = function (x, y) {
  switch (this.mode) {
    case 0x0000: return "#000000FF";
    case 0x0001: return this.paletteCalc(x, y, 1);
    case 0x0002: return this.paletteCalc(x, y, 2);
    case 0x0003: return this.paletteCalc(x, y, 4);
    case 0x0004: return this.paletteCalc(x, y, 8);
    case 0x0005:
    case 0x0006:
      var idx = (y * 256) + x;
      var intensity = ((this.mode == 0x0005 ? this.registers.r1 : this.fetchFromMem(this.registers.r1, (this.register.r5 + idx) & 0xFFFF));
      var red   = this.fetchFromMem(this.registers.r2, (this.registers.r6 + idx) & 0xFFFF));
      var green = this.fetchFromMem(this.registers.r3, (this.registers.r7 + idx) & 0xFFFF));
      var blue  = this.fetchFromMem(this.registers.r4, (this.registers.r8 + idx) & 0xFFFF));
  }
}
SGST.prototype.paletteCalc = function (x, y, bitsPerPixel) {
  var invBitsPerPixel = null;
  var mask = null;
  switch (bitsPerPixel) {
    case  1: invBitsPerPixel = 16; mask = 0x1; break;
    case  2: invBitsPerPixel =  8; mask = 0x3; break;
    case  4: invBitsPerPixel =  4; mask = 0xF; break;
    case  8: invBitsPerPixel =  2; mask = 0xFF; break;
    case 16: invBitsPerPixel =  1; mask = 0xFFFF; break;
  }
  var idx_word = (this.registers.r2 + (((y * 256) + x) / invBitsPerPixel)) & 0xFFFF;
  var idx = ((y * 256) + x) % invBitsPerPixel;
  var paletteIdx = (this.fetchFromFrameBuffer(idx_word) >> (16 - (idx * bitsPerPixel))) & mask;
  return this.fetchFromPalette(paletteIdx);
}
SGST.prototype.fetchFromFrameBuffer = function (addr) { return this.fetchFromMem(this.registers.r1, addr); }
SGST.prototype.fetchFromPalette = function (paletteIdx) {
  var addr = (this.registers.r4 + (palettedIdx * 2)) & 0xFFFF;
  var palette_word1 = this.fetchFromPaletteMem(addr);
  var palette_word2 = this.fetchFromPaletteMem((addr + 1) & 0xFFFF);
  
  var intensity = ((palette_word1 >> 8) & 0xFF).toString(16);
  var red       = (palette_word1 & 0xFF).toString(16);
  var green     = ((palette_word2 >> 8) & 0xFF).toString(16);
  var blue      = (palette_word2 % 0xFF).toString(16);
  
  return "#" + red + "" + green + "" + blue "" + intensity; // quick hack, let intensity be alpha should be spectra strength in 3d  
}
SGST.prototype.fetchFromPaletteMem = function (addr) { return this.fetchFromMem(this.registers.r3, addr); }
SGST.prototype.fetchFromMem = function (slotSel, addr) {
  switch (slotSel) {
    case 0x0000: return this.emulator.RAM[addr];
    case 0x0001: return ((this.exMem1 == null) ? 0x0000 : exMem1.readWord(addr));
    case 0x0002: return ((this.exMem2 == null) ? 0x0000 : exMem2.readWord(addr));
    case 0x0003: return ((this.exMem3 == null) ? 0x0000 : exMem3.readWord(addr));
    case 0x0004: return ((this.exMem4 == null) ? 0x0000 : exMem4.readword(addr));
    default: return 0x0000;
  }
}

SGST.prototype.changeModeOrFrequency = function () {
  var _this = this;
  if (this.drawInterval != null) {  clearInterval(this.drawInterval); }
  this.drawInterval = setInterval(function() { _this.redraw() }, (1 / _this.redrawFrequency));
}