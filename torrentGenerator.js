const WebTorrent = require('webtorrent')
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

class TorrentGenerator {
  static async generate(files, pieceSizeKB) {
    try {
      const client = new WebTorrent()
      const pieceSize = pieceSizeKB * 1024
      
      return new Promise((resolve, reject) => {
        client.seed(files, {
          pieceLength: pieceSize,
          announce: "https://tr.bangumi.moe:9696/announce",
          announceList: [
            ["https://tr.bangumi.moe:9696/announce",
            "http://t.acg.rip:6699/announce",
            "http://tracker.dmhy.org:8000/announce",
            "http://tracker.skyts.net:6969/announce",
            "http://open.acgtracker.com:1096/announce",
            "http://tr.bangumi.moe:6969/announce",
            "http://tracker.lintk.me:2710/announce",
            "http://open.nyaatorrents.info:6544/announce",
            "http://tracker.kuroy.me:5944/announce",
            "http://tracker.skyts.cn:6969/announce",
            "http://t.nyaatracker.com/announce",
            "http://nyaa.tracker.wf:7777/announce",
            "http://tracker.kamigami.org:2710/announce",
            "udp://tracker.dmhy.org:8000/announce",
            "udp://tr.bangumi.moe:6969/announce",
            "udp://tracker.skyts.net:6969/announce",
            "http://tracker.skyts.net:6969/announce",
            "udp://tracker.skyts.cc:6969/announce",
            "udp://tracker.ink:6969/announce",
            "udp://asia.tracker.ink:6969/announce",
            "udp://open.tracker.ink:6969/announce"]
          ]
        }, torrent => {
          const magnetLink = torrent.magnetURI
          client.destroy(err => {
            if (err) return reject(err)
            resolve({ success: true, magnetLink })
          })
        })
      })
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  static async checkCRC32(filePath) {
    return new Promise((resolve) => {
      const crcStream = zlib.createCrc32()
      const readStream = fs.createReadStream(filePath)
      
      readStream.on('data', chunk => crcStream.write(chunk))
      readStream.on('end', () => {
        const crc32 = crcStream.digest('hex')
        const fileName = path.basename(filePath)
        const match = fileName.match(/\(([0-9a-fA-F]{8})\)/)
        
        if (match) {
          const expectedCRC = match[1].toLowerCase()
          resolve({
            match: crc32 === expectedCRC,
            expected: expectedCRC,
            actual: crc32
          })
        } else {
          resolve({ match: null })
        }
      })
    })
  }
}

module.exports = TorrentGenerator
