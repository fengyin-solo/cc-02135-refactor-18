// 共用工具：数据整形、空值规则与展示格式化
// 文件列表、分享详情、分享预览等入口共用，保证同一对象在各入口展示一致

// 空值兜底文案（与后端 serializers.py 保持一致）
const EMPTY_FILE_NAME = '未命名文件';
const EMPTY_USER_NAME = '未知用户';

// 读取字段，缺失或为 null/undefined 时返回默认值
function pick(value, fallback) {
    return value === null || value === undefined ? fallback : value;
}

// 解析为有限数值，失败时返回默认值
function toNumber(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

// HTML转义防止XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = pick(text, '');
    return div.innerHTML;
}

// 获取文件图标
function getFileIcon(filename) {
    const ext = String(pick(filename, '')).split('.').pop().toLowerCase();
    const icons = {
        pdf: '📄', doc: '📝', docx: '📝', txt: '📃',
        jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
        mp3: '🎵', wav: '🎵', mp4: '🎬', avi: '🎬',
        zip: '📦', rar: '📦', '7z': '📦',
        js: '💻', py: '🐍', html: '🌐', css: '🎨'
    };
    return icons[ext] || '📁';
}

// 格式化文件大小
function formatSize(bytes) {
    const size = toNumber(bytes, 0);
    if (size <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(size) / Math.log(k)), sizes.length - 1);
    return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化时间戳
function formatTimestamp(timestamp) {
    if (!timestamp) return '永久有效';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 格式化剩余时间
function formatRemainingTime(expiresAt) {
    if (!expiresAt) return '永久';
    const remaining = expiresAt - (Date.now() / 1000);
    if (remaining <= 0) return '已过期';

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);

    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days} 天 ${hours % 24} 小时`;
    } else if (hours > 0) {
        return `${hours} 小时 ${minutes} 分钟`;
    } else {
        return `${minutes} 分钟`;
    }
}

// 统一整形：文件记录（列表刷新 / 详情返回 / 分享预览共用）
// 旧数据或缺字段记录在此兜底，保证各入口都能正常展示
function normalizeFile(raw) {
    const data = raw || {};
    return {
        id: pick(data.id, ''),
        name: data.name || data.filename || EMPTY_FILE_NAME,
        size: toNumber(pick(data.size, data.filesize), 0),
        uploaded_at: pick(data.uploaded_at, null)
    };
}

// 统一整形：分享记录（分享详情 / 我的分享列表 / 创建成功回显共用）
function normalizeShare(raw) {
    const data = raw || {};
    return {
        share_id: pick(data.share_id, pick(data.id, '')),
        file_id: pick(data.file_id, ''),
        filename: data.filename || data.name || EMPTY_FILE_NAME,
        filesize: toNumber(pick(data.filesize, data.size), 0),
        created_by: data.created_by || EMPTY_USER_NAME,
        expires_at: pick(data.expires_at, null),
        max_downloads: pick(data.max_downloads, null),
        download_count: toNumber(data.download_count, 0),
        created_at: pick(data.created_at, null),
        is_valid: data.is_valid !== false,
        error_msg: data.error_msg || ''
    };
}
