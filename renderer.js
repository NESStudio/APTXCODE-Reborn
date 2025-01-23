// 模板渲染函数
async function renderTemplates(templateData) {
  const templates = await window.electronAPI.renderTemplates(templateData);
  document.getElementById('forum-title').value = templates.forumTitle;
  document.getElementById('forum-content').value = templates.forumContent;
  document.getElementById('alliance-title').value = templates.allianceTitle;
  document.getElementById('alliance-content').value = templates.allianceContent;
}

document.addEventListener('DOMContentLoaded', () => {
  // 初始化变量
  let selectedFiles = [];
  const templatePanes = document.querySelectorAll('.template-pane');
  const tabButtons = document.querySelectorAll('.tab-button');
  const fileList = document.getElementById('file-list');
  const pieceLengthSelect = document.getElementById('piece-length');

  // 添加复制按钮事件监听器
  document.querySelectorAll('.copy-button').forEach(button => {
    button.addEventListener('click', async (e) => {
      const targetId = e.target.dataset.target;
      const textarea = document.getElementById(targetId);
      
      try {
        await navigator.clipboard.writeText(textarea.value);
        e.target.textContent = '复制成功!';
        setTimeout(() => {
          e.target.textContent = '复制';
        }, 2000);
      } catch (err) {
        console.error('复制失败:', err);
        e.target.textContent = '复制失败';
        setTimeout(() => {
          e.target.textContent = '复制';
        }, 2000);
      }
    });
  });
  
  // 文件选择事件
  document.getElementById('select-files').addEventListener('click', async () => {
    try {
      selectedFiles = await window.electronAPI.selectFiles();
      updateFileList();
      checkSingleFileCRC32();
    } catch (error) {
      console.error('文件选择失败:', error);
    }
  });

  // 更新文件列表
  function updateFileList() {
    fileList.innerHTML = selectedFiles
      .map(file => {
        const fileName = window.electronAPI.basename(file);
        return `<div class="file-item">${fileName}</div>`;
      })
      .join('');
  }

  // 检查单个文件的CRC32
  async function checkSingleFileCRC32() {
    if (selectedFiles.length === 1) {
      const filePath = selectedFiles[0];
      const fileName = window.electronAPI.basename(filePath);
      
      // 检查文件名是否包含CRC32
      const crc32Match = fileName.match(/\(([0-9a-fA-F]{8})\)$/);
      if (crc32Match) {
        const expectedCRC32 = crc32Match[1].toLowerCase();
        const actualCRC32 = await window.electronAPI.calculateCRC32(filePath);
        
        if (actualCRC32 !== expectedCRC32) {
          alert(`CRC32校验失败\n期望值: ${expectedCRC32}\n实际值: ${actualCRC32}`);
        }
      }
    }
  }

  // 模板切换
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // 切换激活状态
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // 显示对应模板
      const templateType = button.dataset.template;
      templatePanes.forEach(pane => pane.classList.remove('active'));
      document.getElementById(`${templateType}-template`).classList.add('active');
    });
  });

  // 生成按钮点击事件
  document.getElementById('generate').addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
      alert('请先选择文件');
      return;
    }

    try {
      const pieceLength = parseInt(pieceLengthSelect.value);
      
      // 生成torrent
      const torrentInfo = await window.electronAPI.createTorrent(selectedFiles, pieceLength);
      
      // 准备模板数据
      // Calculate total file size
      const fileSize = await window.electronAPI.calculateTotalSize(selectedFiles);
      
      // Set expire date to 30 days from now
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + 30);
      const formattedExpireDate = `${expireDate.getFullYear()}-${String(expireDate.getMonth() + 1).padStart(2, '0')}-${String(expireDate.getDate()).padStart(2, '0')}`;

      const templateData = {
        magnetLink: torrentInfo.magnetLink,
        torrentFile: torrentInfo.torrentFileName,
        files: selectedFiles.map(file => window.electronAPI.basename(file)),
        fileSize: fileSize,
        expireDate: formattedExpireDate,
        pieceLength: pieceLength,
        title: document.getElementById('title').value,
        isMovie: document.getElementById('isMovie').checked,
        episode: document.getElementById('episode').value,
        releaseType: document.getElementById('releaseType').value
      };

      // 渲染模板
      await renderTemplates(templateData);

      // 显示成功消息
      const successMessage = `种子文件生成成功！\n\n文件名: ${torrentInfo.torrentFileName}\n\nMagnet链接: ${torrentInfo.magnetLink}`;
      alert(successMessage);

    } catch (error) {
      console.error('生成失败:', error);
      alert('生成过程中出现错误: ' + error.message);
    }
  });
});
