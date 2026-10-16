import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { errorMessage } from '../api'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setLoading(true)
    try {
      await register(username.trim(), password)
      navigate('/apply', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-page">
      <div className="form-card">
        <h2>加入 <span className="title-glow">CUBE</span></h2>
        <p className="form-sub">注册账号，开始你的报名之旅</p>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>用户名</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="3-32 位字符" autoComplete="username" required minLength={3} maxLength={32} />
          </div>
          <div className="field">
            <label>密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位" autoComplete="new-password" required minLength={6} maxLength={64} />
          </div>
          <div className="field">
            <label>确认密码</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="再输入一次密码" autoComplete="new-password" required />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? '注册中…' : '注册'}
          </button>
        </form>
        <div className="form-switch">
          已有账号？<Link to="/login">直接登录</Link>
        </div>
      </div>
    </div>
  )
}
