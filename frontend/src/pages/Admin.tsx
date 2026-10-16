import { useEffect, useState } from 'react'
import api, { errorMessage } from '../api'

interface ApplicationItem {
  id: number
  username: string
  realName: string
  studentId: string | null
  phone: string | null
  intro: string | null
  resumeOriginalName: string
  createdAt: string
}

export default function Admin() {
  const [list, setList] = useState<ApplicationItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    api.get('/admin/applications')
      .then((res) => setList(res.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  async function downloadResume(item: ApplicationItem) {
    setDownloadingId(item.id)
    try {
      const res = await api.get(`/admin/applications/${item.id}/resume`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = item.resumeOriginalName || `${item.realName}-简历.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setDownloadingId(null)
    }
  }

  async function removeApplication(item: ApplicationItem) {
    if (!confirm(`确定删除「${item.realName}」的报名吗？简历文件会一并清除，无法恢复。`)) return
    setDeletingId(item.id)
    try {
      await api.delete(`/admin/applications/${item.id}`)
      setList((prev) => prev.filter((x) => x.id !== item.id))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="admin-page">
      <div className="container">
        <h2 className="section-title">招新 <span className="title-glow">投递管理</span></h2>
        <p className="section-sub">共收到 {list.length} 份报名</p>
        {error && <div className="form-error">{error}</div>}
        {loading ? (
          <div className="empty-state">加载中…</div>
        ) : list.length === 0 ? (
          <div className="empty-state">目前还没有人报名，去把招新链接分享出去吧</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>账号</th>
                  <th>学号</th>
                  <th>联系方式</th>
                  <th>自我介绍</th>
                  <th>提交时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.id}>
                    <td>{item.realName}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{item.username}</td>
                    <td>{item.studentId || '—'}</td>
                    <td>{item.phone || '—'}</td>
                    <td className="intro-cell">
                      {item.intro ? (item.intro.length > 60 ? item.intro.slice(0, 60) + '…' : item.intro) : '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{item.createdAt}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => downloadResume(item)}
                        disabled={downloadingId === item.id || deletingId === item.id}>
                        {downloadingId === item.id ? '下载中…' : '下载 PDF'}
                      </button>{' '}
                      <button className="btn btn-sm btn-danger" onClick={() => removeApplication(item)}
                        disabled={deletingId === item.id || downloadingId === item.id}>
                        {deletingId === item.id ? '删除中…' : '删除'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
