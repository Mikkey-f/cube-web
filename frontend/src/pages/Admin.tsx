import { useEffect, useState, type FormEvent } from 'react'
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

interface MessageItem {
  id: number
  nickname: string
  content: string
  approved: boolean
  createdAt: string
}

interface MusicItem {
  id: number
  title: string
  url: string
  size: number
  createdAt: string
}

export default function Admin() {
  const [list, setList] = useState<ApplicationItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // 祝福墙审核
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [msgLoading, setMsgLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState<number | null>(null)

  // 背景音乐管理
  const [musics, setMusics] = useState<MusicItem[]>([])
  const [musicTitle, setMusicTitle] = useState('')
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [musicUploading, setMusicUploading] = useState(false)
  const [musicTip, setMusicTip] = useState('')

  useEffect(() => {
    api.get('/admin/applications')
      .then((res) => setList(res.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
    api.get('/admin/messages')
      .then((res) => setMessages(res.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setMsgLoading(false))
    loadMusics()
  }, [])

  function loadMusics() {
    api.get<MusicItem[]>('/music')
      .then((res) => setMusics(res.data))
      .catch(() => {})
  }

  async function uploadMusic(e: FormEvent) {
    e.preventDefault()
    if (!musicFile || !musicTitle.trim() || musicUploading) return
    setMusicUploading(true)
    setMusicTip('')
    try {
      const fd = new FormData()
      fd.append('title', musicTitle.trim())
      fd.append('file', musicFile)
      await api.post('/admin/music', fd)
      setMusicTitle('')
      setMusicFile(null)
      setMusicTip('上传成功')
      loadMusics()
    } catch (err) {
      setMusicTip(errorMessage(err))
    } finally {
      setMusicUploading(false)
    }
  }

  async function removeMusic(item: MusicItem) {
    if (!confirm(`确定删除「${item.title}」吗？音乐文件会一并清除。`)) return
    try {
      await api.delete(`/admin/music/${item.id}`)
      setMusics((prev) => prev.filter((x) => x.id !== item.id))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function reviewMessage(item: MessageItem, approved: boolean) {
    setReviewingId(item.id)
    try {
      const { data } = await api.put(`/admin/messages/${item.id}`, { approved })
      setMessages((prev) => prev.map((x) => (x.id === item.id ? data : x)))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setReviewingId(null)
    }
  }

  async function removeMessage(item: MessageItem) {
    if (!confirm('确定删除这条留言吗？无法恢复。')) return
    setReviewingId(item.id)
    try {
      await api.delete(`/admin/messages/${item.id}`)
      setMessages((prev) => prev.filter((x) => x.id !== item.id))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setReviewingId(null)
    }
  }

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

        {/* ---------- 祝福墙审核 ---------- */}
        <h2 className="section-title" style={{ marginTop: 72 }}>祝福墙 <span className="title-glow">留言审核</span></h2>
        <p className="section-sub">
          共 {messages.length} 条留言，其中 {messages.filter((m) => m.approved).length} 条已上墙
        </p>
        {msgLoading ? (
          <div className="empty-state">加载中…</div>
        ) : messages.length === 0 ? (
          <div className="empty-state">还没有留言，首页祝福墙会显示占位文案</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>昵称</th>
                  <th>留言内容</th>
                  <th>提交时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nickname}</td>
                    <td className="intro-cell">{item.content}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{item.createdAt}</td>
                    <td>
                      <span className={`msg-badge ${item.approved ? 'on' : ''}`}>
                        {item.approved ? '已上墙' : '待审核'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {item.approved ? (
                        <button className="btn btn-sm" onClick={() => reviewMessage(item, false)}
                          disabled={reviewingId === item.id}>
                          下架
                        </button>
                      ) : (
                        <button className="btn btn-sm btn-primary" onClick={() => reviewMessage(item, true)}
                          disabled={reviewingId === item.id}>
                          通过
                        </button>
                      )}{' '}
                      <button className="btn btn-sm btn-danger" onClick={() => removeMessage(item)}
                        disabled={reviewingId === item.id}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ---------- 背景音乐管理 ---------- */}
        <h2 className="section-title" style={{ marginTop: 72 }}>背景音乐 <span className="title-glow">曲库管理</span></h2>
        <p className="section-sub">上传 MP3 到首页播放器（单曲 ≤15MB，建议 128kbps 以省带宽）</p>

        <form className="music-form" onSubmit={uploadMusic}>
          <input
            className="wish-input"
            type="text"
            value={musicTitle}
            onChange={(e) => setMusicTitle(e.target.value)}
            placeholder="曲目标题"
            maxLength={64}
            required
          />
          <input
            className="music-file"
            type="file"
            accept="audio/mpeg,.mp3"
            onChange={(e) => setMusicFile(e.target.files?.[0] ?? null)}
            required
          />
          <button className="btn btn-primary" type="submit" disabled={musicUploading || !musicTitle.trim() || !musicFile}>
            {musicUploading ? '上传中…' : '上传'}
          </button>
        </form>
        {musicTip && <p className={`wish-tip ${musicTip === '上传成功' ? 'ok' : 'err'}`}>{musicTip}</p>}

        {musics.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 16 }}>曲库为空，上传第一首背景音乐吧</div>
        ) : (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>大小</th>
                  <th>上传时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {musics.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{(item.size / 1024 / 1024).toFixed(1)} MB</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{item.createdAt}</td>
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={() => removeMusic(item)}>删除</button>
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
