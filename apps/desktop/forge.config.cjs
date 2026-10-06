module.exports = {
  outDir: '../../.local/desktop-out',
  packagerConfig: {
    asar: true,
    executableName: 'SRD',
  },
  makers: [{
    name: '@electron-forge/maker-squirrel',
    config: { name: 'SRD', setupExe: 'SRD-Setup.exe' },
  }],
};
