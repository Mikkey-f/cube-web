import { useEffect, useState, type FormEvent } from 'react'
import api, { errorMessage } from '../api'

interface MyApplication {
  realName: string
  studentId: string | null
  phone: string | null
  intro: string | null
  resumeOriginalName: string
  createdAt: string
}

export default function Apply() {
  const [submitted, setSubmitted] = useState<MyApplication | null>(null)
  const [checking, setChecking] = useState(true)

  const [realName, setRealName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [phone, setPhone] = useState('')
  const [intro, setIntro] = useState('')
  const [resume, setResume] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/applications/me')
      .then((res) => {
        if (res.status === 200 && res.data) setSubmitted(res.data)
      })
      .catch(() => { /* 未提交过则保持表单 */ })
      .finally(() => setChecking(false))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!resume) {
      setError('请上传 PDF 格式的简历')
      return
    }
    if (!resume.name.toLowerCase().endsWith('.pdf')) {
      setError('只支持 PDF 格式的简历')
      return
    }
    if (resume.size > 20 * 1024 * 1024) {
      setError('简历文件不能超过 20MB')
      return
    }

    const formData = new FormData()
    formData.append('realName', realName.trim())
    formData.append('studentId', studentId.trim())
    formData.append('phone', phone.trim())
    formData.append('intro', intro.trim())
    formData.append('resume', resume)

    setLoading(true)
    try {
      const res = await api.post('/applications', formData)
      setSubmitted(res.data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="form-page">
        <div className="form-card"><p style={{ color: 'var(--text-dim)' }}>加载中…</p></div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="form-page">
        <div className="form-card wide">
          <h2>报名已提交</h2>
          <p className="form-sub">我们已收到你的报名，请耐心等待审核结果</p>
          <div className="form-success">提交时间：{submitted.createdAt}</div>
          <table className="data-table" style={{ minWidth: 0 }}>
            <tbody>
              <tr><th style={{ width: 110 }}>姓名</th><td>{submitted.realName}</td></tr>
              <tr><th>学号</th><td>{submitted.studentId || '—'}</td></tr>
              <tr><th>联系方式</th><td>{submitted.phone || '—'}</td></tr>
              <tr><th>简历</th><td>{submitted.resumeOriginalName}</td></tr>
              {submitted.intro && <tr><th>自我介绍</th><td style={{ color: 'var(--text-dim)' }}>{submitted.intro}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="form-page">
      <div className="form-card wide">
        <h2>招新 <span className="title-glow">报名</span></h2>
        <p className="form-sub">每个账号限提交一次，请认真填写</p>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>姓名<span className="required">*</span></label>
            <input value={realName} onChange={(e) => setRealName(e.target.value)}
              placeholder="真实姓名" required maxLength={64} />
          </div>
          <div className="field">
            <label>学号</label>
            <input value={studentId} onChange={(e) => setStudentId(e.target.value)}
              placeholder="选填" maxLength={64} />
          </div>
          <div className="field">
            <label>联系方式</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="手机号或 QQ，选填" maxLength={32} />
          </div>
          <div className="field">
            <label>自我介绍</label>
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)}
              placeholder="聊聊你的技术经历、兴趣爱好，或者你为什么想加入 CUBE（选填）" maxLength={2000} />
          </div>
          <div className="field">
            <label>简历（PDF，不超过 20MB）<span className="required">*</span></label>
            <input type="file" accept=".pdf,application/pdf"
              onChange={(e) => setResume(e.target.files?.[0] ?? null)} required />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? '提交中…' : '提交报名'}
          </button>
        </form>
      </div>
    </div>
  )
}
