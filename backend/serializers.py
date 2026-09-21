"""统一的数据整形与空值规则

文件列表、分享详情、分享列表等入口共用同一份整形结果，
避免同一对象在不同入口出现不同格式或缺失字段。
旧数据或缺字段记录在此统一兜底，保证各入口都能正常展示。
"""
import time

# 空值兜底文案（与前端 common.js 保持一致）
EMPTY_FILE_NAME = '未命名文件'
EMPTY_USER_NAME = '未知用户'

# 分享信息联表查询：分享详情、分享列表、分享下载共用
SHARE_WITH_FILE_QUERY = '''
    SELECT s.id, s.file_id, s.created_by, s.expires_at, s.max_downloads, s.download_count, s.created_at,
           f.name as filename, f.size as filesize
    FROM share_links s
    JOIN files f ON s.file_id = f.id
'''


def _field(data, key, default=None):
    """读取记录字段，缺失或为 None 时返回默认值"""
    value = data.get(key)
    return default if value is None else value


def shape_file(record):
    """整形 files 表记录，列表/详情/分享入口返回同一结构"""
    if record is None:
        return None
    data = dict(record)
    return {
        'id': _field(data, 'id', ''),
        'name': _field(data, 'name', EMPTY_FILE_NAME),
        'size': _field(data, 'size', 0),
        'uploaded_at': _field(data, 'uploaded_at'),
    }


def check_share_validity(record):
    """检查分享链接状态，返回 (是否有效, 无效原因)"""
    if record is None:
        return False, '分享链接不存在'

    data = dict(record)

    expires_at = data.get('expires_at')
    if expires_at is not None and expires_at < time.time():
        return False, '分享链接已过期'

    max_downloads = data.get('max_downloads')
    download_count = data.get('download_count') or 0
    if max_downloads is not None and download_count >= max_downloads:
        return False, '分享链接下载次数已用完'

    return True, None


def shape_share(record):
    """整形分享联表记录，附带统一空值规则与状态字段"""
    if record is None:
        return None
    data = dict(record)
    valid, error_msg = check_share_validity(data)
    return {
        'share_id': _field(data, 'id', ''),
        'file_id': _field(data, 'file_id', ''),
        'filename': _field(data, 'filename', EMPTY_FILE_NAME),
        'filesize': _field(data, 'filesize', 0),
        'created_by': _field(data, 'created_by', EMPTY_USER_NAME),
        'expires_at': _field(data, 'expires_at'),
        'max_downloads': _field(data, 'max_downloads'),
        'download_count': _field(data, 'download_count', 0),
        'created_at': _field(data, 'created_at'),
        'is_valid': valid,
        'error_msg': error_msg,
    }
