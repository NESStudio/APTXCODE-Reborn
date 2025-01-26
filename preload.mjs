import { contextBridge, ipcRenderer } from 'electron'
import path from 'node:path'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  renderTemplates: (data) => ipcRenderer.invoke('render-templates', data),
  calculateCRC32: (filePath) => ipcRenderer.invoke('calculateCRC32', filePath),
  createTorrent: (files, pieceLength) => ipcRenderer.invoke('createTorrent', files, pieceLength),
  basename: (filePath) => path.basename(filePath),
  calculateTotalSize: (files) => ipcRenderer.invoke('calculateTotalSize', files),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  handleDrop: (filePaths) => ipcRenderer.invoke('handle-drop', filePaths) // 添加 handleDrop 方法
})

// 安全警告
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
})
