import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import crypto from 'crypto'
import bencode from 'bencode'
import Handlebars from 'handlebars'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 模板文件路径
const TEMPLATES = {
  forumTitle: path.join(__dirname, 'templates/forum-title.hbs'),
  forumContent: path.join(__dirname, 'templates/forum-content.hbs'),
  allianceTitle: path.join(__dirname, 'templates/alliance-title.hbs'),
  allianceContent: path.join(__dirname, 'templates/alliance-content.hbs')
}

// 创建窗口
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: './assets/icons/icon.png',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      enableRemoteModule: false,
      experimentalFeatures: true,
      nodeIntegrationInWorker: true,
      nodeIntegrationInSubFrames: true,
      webSecurity: false
    }
  })

  mainWindow.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 处理文件/文件夹选择
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'openDirectory', 'multiSelections']
  })
  
  // 递归获取所有文件路径
    const getAllFiles = async (filePath) => {
      const stats = await fs.promises.stat(filePath)
      if (stats.isFile()) {
        return [filePath]
      }
      
      const files = []
      const items = await fs.promises.readdir(filePath)
      for (const item of items) {
        // 忽略.DS_Store等系统文件
        if (item.startsWith('.') || item === 'Thumbs.db') {
          continue
        }
        const fullPath = path.join(filePath, item)
        files.push(...await getAllFiles(fullPath))
      }
      return files
    }

  const allFiles = []
  for (const filePath of result.filePaths) {
    allFiles.push(...await getAllFiles(filePath))
  }
  
  return allFiles
})

// 计算CRC32校验值
function calculateCRC32(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('crc32')
    const stream = fs.createReadStream(filePath)
    
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

// 计算文件总大小
ipcMain.handle('calculateTotalSize', async (event, files) => {
  let totalSize = 0;
  for (const file of files) {
    const stats = await fs.promises.stat(file);
    totalSize += stats.size;
  }
  // Convert to MB with 2 decimal places
  return `${(totalSize / 1024 / 1024).toFixed(2)} MB`;
});

// 生成torrent和magnet链接
ipcMain.handle('createTorrent', async (event, files, pieceLength) => {
  try {
    console.log('Received files:', files);
    console.log('Piece length:', pieceLength);

    if (!files || files.length === 0) {
      throw new Error('No files selected');
    }

    let torrentName;
    if (files.length === 1) {
      const stats = fs.statSync(files[0]);
      if (stats.isDirectory()) {
        torrentName = path.basename(files[0]);
      } else {
        torrentName = path.basename(files[0]);
      }
    } else {
      // 如果选择的是多个文件/文件夹，使用第一个文件的父目录名
      const firstFile = files[0];
      const parentDir = path.dirname(firstFile);
      const parentStats = fs.statSync(parentDir);
      if (parentStats.isDirectory()) {
        torrentName = path.basename(parentDir);
      } else {
        // 如果父目录不是文件夹（不太可能的情况），使用第一个文件名
        torrentName = path.basename(firstFile);
      }
    }

    // Default trackers
    const defaultTrackers = [
      'https://tr.bangumi.moe:9696/announce',
      'http://t.acg.rip:6699/announce',
      'http://tracker.dmhy.org:8000/announce',
      'http://tracker.skyts.net:6969/announce',
      'http://open.acgtracker.com:1096/announce',
      'http://tr.bangumi.moe:6969/announce',
      'http://tracker.lintk.me:2710/announce',
      'http://open.nyaatorrents.info:6544/announce',
      'http://tracker.kuroy.me:5944/announce',
      'http://tracker.skyts.cn:6969/announce',
      'http://t.nyaatracker.com/announce',
      'http://nyaa.tracker.wf:7777/announce',
      'http://tracker.kamigami.org:2710/announce',
      'udp://tracker.dmhy.org:8000/announce',
      'udp://tr.bangumi.moe:6969/announce',
      'udp://tracker.skyts.net:6969/announce',
      'http://tracker.skyts.net:6969/announce',
      'udp://tracker.skyts.cc:6969/announce',
      'udp://tracker.ink:6969/announce',
      'udp://asia.tracker.ink:6969/announce',
      'udp://open.tracker.ink:6969/announce'
    ];

    const torrent = {
      announce: defaultTrackers[0],
      'announce-list': [defaultTrackers],
      info: {
        'piece length': pieceLength,
        name: torrentName,
        files: files.map(file => {
          console.log('Processing file:', file);
          const fileStats = fs.statSync(file);
          if (!fileStats.isFile()) {
            throw new Error(`Path is not a file: ${file}`);
          }
          return {
            path: [path.relative(path.dirname(files[0]), file)],
            length: fileStats.size
          };
        }),
        // Generate pieces
        pieces: (() => {
          const pieces = [];
          let piece = Buffer.alloc(0);
          
          for (const file of files) {
            const data = fs.readFileSync(file);
            piece = Buffer.concat([piece, data]);
            
            while (piece.length >= pieceLength) {
              const pieceData = piece.slice(0, pieceLength);
              const hash = crypto.createHash('sha1').update(pieceData).digest();
              pieces.push(hash);
              piece = piece.slice(pieceLength);
            }
          }
          
          // Add remaining data if any
          if (piece.length > 0) {
            const hash = crypto.createHash('sha1').update(piece).digest();
            pieces.push(hash);
          }
          
          return Buffer.concat(pieces);
        })()
      }
    }

    console.log('Created torrent structure:', torrent);

    // 计算info hash
    const infoBuffer = bencode.encode(torrent.info);
    console.log('Encoded info buffer:', infoBuffer);
    const infoHash = crypto.createHash('sha1').update(infoBuffer).digest('hex');
    console.log('Generated info hash:', infoHash);

    // 生成magnet链接
    const magnetLink = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(torrent.info.name)}&tr=${defaultTrackers.map(encodeURIComponent).join('&tr=')}`;
    console.log('Generated magnet link:', magnetLink);

    // 创建.torrent文件
    const torrentFileName = `${torrent.info.name}.torrent`;
    
    // 显示保存对话框
    const { filePath } = await dialog.showSaveDialog({
      title: '保存种子文件',
      defaultPath: torrentFileName,
      filters: [
        { name: 'Torrent Files', extensions: ['torrent'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!filePath) {
      throw new Error('保存操作已取消');
    }

    console.log('Writing torrent file to:', filePath);
    await fs.promises.writeFile(filePath, bencode.encode(torrent));
    console.log('Successfully wrote torrent file');

    return {
      infoHash,
      magnetLink,
      torrentFilePath: filePath,
      torrentFileName: path.basename(filePath)
    }
  } catch (error) {
    console.error('Error in createTorrent:', error);
    throw error;
  }
})

// 渲染模板
async function renderTemplate(templatePath, data) {
  const templateContent = await fs.promises.readFile(templatePath, 'utf8')
  const template = Handlebars.compile(templateContent)
  return template(data)
}

// 处理模板生成请求
ipcMain.handle('render-templates', async (event, data) => {
  const results = {}
  
  for (const [key, templatePath] of Object.entries(TEMPLATES)) {
    results[key] = await renderTemplate(templatePath, data)
  }
  
  return results
})
