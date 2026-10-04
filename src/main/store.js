const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Store {
  constructor(defaults = {}) {
    const userDataPath = app ? app.getPath('userData') : __dirname;
    this.path = path.join(userDataPath, 'powder-settings.json');
    this.defaults = defaults;
    this.data = this.parseDataFile(this.path, defaults);
  }

  get(key) {
    return this.data[key] !== undefined ? this.data[key] : this.defaults[key];
  }

  set(key, val) {
    this.data[key] = val;
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('Error writing settings file:', err);
    }
  }

  parseDataFile(filePath, defaults) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (error) {
      console.error('Error reading settings file:', error);
    }
    return defaults;
  }
}

module.exports = Store;
