/**
 * 文件目录数据映射（列表、详情、分享入口共用）
 *
 * 后端 /api/files、/api/share、/api/shares 返回同一份字段契约，
 * 这里再对旧数据与缺字段记录做一次空值兜底，保证三个入口
 * （文件库列表、分享列表、分享预览详情）展示格式完全一致。
 */

// 缺省展示文案
const DEFAULT_FILE_NAME = '未知文件';
const DEFAULT_USER_NAME = '未知用户';

// HTML 转义，防止 XSS
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// 兼容旧字段名（旧后端数据可能仍是 filename/filesize）
function pickField(source, keys, fallback) {
    for (const key of keys) {
        const value = source ? source[key] : undefined;
        if (value !== null && value !== undefined && value !== '') return value;
    }
    return fallback;
}

/**
 * 统一的文件对象整形
 * 输出字段：id / name / size / uploadedAt / createdAt
 */
function normalizeFile(raw) {
    const file = raw || {};
    const uploadedAt = pickField(file, ['uploaded_at', 'uploadedAt', 'created_at', 'createdAt'], null);
    return {
        id: pickField(file, ['id', 'file_id'], ''),
        name: pickField(file, ['name', 'filename'], DEFAULT_FILE_NAME),
        size: Number.isFinite(Number(file.size)) ? Number(file.size)
            : Number.isFinite(Number(file.filesize)) ? Number(file.filesize) : 0,
        uploadedAt,
        createdAt: uploadedAt
    };
}

/**
 * 分享状态判断，与后端 is_share_valid 同一条规则
 */
function getShareValidity(share) {
    if (share.is_valid === false || share.isValid === false) {
        return { isValid: false, errorMsg: share.error_msg || share.errorMsg || '无效' };
    }
    if (share.is_valid === true || share.isValid === true) {
        return { isValid: true, errorMsg: share.error_msg || share.errorMsg || null };
    }
    // 缺字段记录：按时间与下载次数兜底判断
    if (share.expires_at !== null && share.expires_at !== undefined
        && Number(share.expires_at) * 1000 <= Date.now()) {
        return { isValid: false, errorMsg: share.error_msg || share.errorMsg || '分享链接已过期' };
    }
    const max = share.max_downloads ?? share.maxDownloads;
    if (max !== null && max !== undefined && Number(max) >= 0
        && Number(share.download_count ?? share.downloadCount ?? 0) >= Number(max)) {
        return { isValid: false, errorMsg: share.error_msg || share.errorMsg || '分享链接下载次数已用完' };
    }
    return { isValid: true, errorMsg: share.error_msg || share.errorMsg || null };
}

/**
 * 统一的分享对象整形（包含内嵌的文件信息）
 * 时间字段（expires_at / created_at）后端为秒级时间戳；
 * created_at 的旧数据是 SQLite 时间字符串，原样保留由格式化函数处理。
 */
function normalizeShare(raw) {
    const share = raw || {};
    const file = normalizeFile(share);
    const expiresAt = pickField(share, ['expires_at', 'expiresAt'], null);
    const createdAt = pickField(share, ['created_at', 'createdAt', 'uploaded_at', 'uploadedAt'], null);
    const maxDownloadsRaw = share.max_downloads ?? share.maxDownloads;
    const validity = getShareValidity(share);

    return {
        shareId: pickField(share, ['share_id', 'shareId'], ''),
        fileId: pickField(share, ['file_id', 'fileId'], file.id),
        name: file.name,
        size: file.size,
        createdBy: pickField(share, ['created_by', 'createdBy'], DEFAULT_USER_NAME),
        expiresAt: expiresAt === null ? null : Number(expiresAt),
        // null / -1 均表示无限制，统一归一为 null
        maxDownloads: maxDownloadsRaw === null || maxDownloadsRaw === undefined || Number(maxDownloadsRaw) < 0
            ? null : Number(maxDownloadsRaw),
        downloadCount: Number.isFinite(Number(share.download_count)) ? Number(share.download_count)
            : Number.isFinite(Number(share.downloadCount)) ? Number(share.downloadCount) : 0,
        createdAt,
        uploadedAt: file.uploadedAt,
        isValid: validity.isValid,
        errorMsg: validity.errorMsg
    };
}

// 文件图标
function getFileIcon(filename) {
    const name = filename || '';
    const ext = (name.includes('.') ? name.split('.').pop() : '').toLowerCase();
    const icons = {
        pdf: '📄', doc: '📝', docx: '📝', txt: '📃',
        jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
        mp3: '🎵', wav: '🎵', mp4: '🎬', avi: '🎬',
        zip: '📦', rar: '📦', '7z': '📦',
        js: '💻', py: '🐍', html: '🌐', css: '🎨'
    };
    return icons[ext] || '📁';
}

// 格式化文件大小（缺失 / 非法大小统一显示 0 B）
function formatSize(bytes) {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(size) / Math.log(k)), sizes.length - 1);
    return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 解析后端时间：秒级时间戳或 SQLite/ISO 时间字符串，失败返回 null
function parseBackendTime(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
        return new Date(value < 1e12 ? value * 1000 : value);
    }
    const text = String(value);
    // 纯数字字符串按时间戳处理
    if (/^\d+(\.\d+)?$/.test(text)) {
        const numeric = Number(text);
        return new Date(numeric < 1e12 ? numeric * 1000 : numeric);
    }
    // SQLite "YYYY-MM-DD HH:MM:SS" 在部分浏览器需要补 T
    const parsed = new Date(text.replace(' ', 'T'));
    return isNaN(parsed.getTime()) ? new Date(text) : parsed;
}

// 格式化时间戳/时间字符串；空值按永久有效展示
function formatTimestamp(timestamp) {
    const date = parseBackendTime(timestamp);
    if (!date || isNaN(date.getTime())) return '永久有效';
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 普通时间字段（如创建时间）；空值展示占位
function formatDateTime(value) {
    const date = parseBackendTime(value);
    if (!date || isNaN(date.getTime())) return '—';
    return date.toLocaleString('zh-CN');
}

// 格式化剩余时间
function formatRemainingTime(expiresAt) {
    if (expiresAt === null || expiresAt === undefined || expiresAt === '') return '永久';
    const expireDate = parseBackendTime(expiresAt);
    if (!expireDate) return '永久';
    const remaining = (expireDate.getTime() - Date.now()) / 1000;
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

// 下载次数文案：有上限 "已用 / 上限 次"，无上限 "已用 次（无限制）"
function formatDownloadCount(share) {
    const used = share.downloadCount;
    return share.maxDownloads === null
        ? `${used} 次（无限制）`
        : `${used} / ${share.maxDownloads} 次`;
}

// 分享状态文案
function formatShareStatus(share) {
    return share.isValid ? '有效' : (share.errorMsg || '无效');
}

// 暴露到全局，供 app.js / share.html 使用
window.FileData = {
    DEFAULT_FILE_NAME,
    DEFAULT_USER_NAME,
    escapeHtml,
    normalizeFile,
    normalizeShare,
    getFileIcon,
    formatSize,
    formatTimestamp,
    formatDateTime,
    formatRemainingTime,
    formatDownloadCount,
    formatShareStatus
};
