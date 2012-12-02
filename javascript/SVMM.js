// to be used in dcpu16-ide by dangermccann at http://aws.johnmccann.me/

function SVMM(_emulator) {
  this.id = 0x53564D4D;
  this.version = 0x0001;
  this.manufacturer = 0x5A52544E;
  this.emulator = _emulator;
  this.memory = null;
  
  this.icon = document.createElement("img");
  this.icon.src = "data:image/png," ; // 16x16 px image with VGA lightgreen border with the text "64K SVMM" inside in same colour.
  this.icon.width = 16;
  this.icon.height = 16;
}

SVMM.prototype.init = function() {
  this.memory = [];
  this.transferInteruptMessage = 0xFFFF;
  this.transferWordsLeft = 0;
  this.transferDeviceAddress = 0x0000;
  this.transferDCPUAddress = 0x0000;
  this.transferDirection = SVMM.operations.bulkToDCPU;
}

SVMM.prototype.interrupt = function () {
  var aVal = this.emulator.Registers.A.get();
  var bVal = this.emulator.Registers.B.get();
  var cVal = this.emulator.Registers.C.get();
  var xVal = this.emulator.Registers.X.get();
  var yVal = this.emulator.Registers.Y.get();
  
  if (aVal == SVMM.operations.readWord) {
    this.emulator.Registers.C.set(this.readWord(bVal));
  } else if (aVal == SVMM.operations.writeWord) {
    this.writeWord(bVal, cVal);
  } else if ((aVal == SVMM.operations.bulkToDCPU) || (aVal == SVMM.operations.bulkFromDCPU)) {
    if (this.transferWordsLeft != 0) {
      this.emulator.Registers.A.set(0x0000);
      return;
    } else {
      this.emulator.Registers.A.set(0xFFFF);
    }
    this.transferDirection = aVal;
    this.transferDeviceAddress = bVal;
    this.transferDCPUAddress = cVal;
    this.transferWordsLeft = xVal;
    this.transferInteruptMessage = yVal;
    var _this = this;
    this.doTransfer = function () {
      if (_this.transferWordsLeft > 0x0000) {
        if (_this.transferDirection == SVMM.operations.bulkToDCPU) {
          _this.emulator.ram[_this.transferDCPUAddress] = _this.readWord(_this.transferDeviceAddress);
        } else if (_this.transferDirection == SVMM.operations.bulkFromDCPU) {
          _this.writeWord(_this.transferDeviceAddress, _this.emulator.ram[_this.transferDCPUAddress]);
        }
        _this.transferDCPUAddress = (_this.transferDCPUAddress + 1) & 0xFFFF;
        _this.transferDeviceAddress = (_this.transferDeviceAddress + 1) & 0xFFFF;
        _this.transferWordsLeft -= 1;
        setTimeout(_this.doTransfer, _this.emulator.currentSpeed.delayTime);
      } else {
        _this.emulator.interupt(_this.transferInteruptMessage);
      }
    }
    setTimeout(this.doTransfer, this.emulator.currentSpeed.delayTime);
  }
}

SVMM.prototype.readWord = function (address) {
  if (this.memory[address] != null) {
    return this.memory[address];
  } else {
    return 0x0000;
  }
}
SVMM.prototype.writeWord = function (address, newvalue) {
  this.memory[address] = newvalue;
}

SVMM.operations = {};
SVMM.operations.readWord     = 0x0001;
SVMM.operations.writeWord    = 0x0002;
SVMM.operations.bulkToDCPU   = 0x0003;
SVMM.operations.bulkFromDCPU = 0x0004;