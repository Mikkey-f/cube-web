import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <img src="/logo.jpg" alt="CUBE logo" />
          <span className="title-glow">CUBE</span>
        </Link>
        <div className="navbar-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>首页</NavLink>
          <NavLink to="/apply" className={({ isActive }) => (isActive ? 'active' : '')}>招新报名</NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>后台管理</NavLink>
          )}
        </div>
        <div className="navbar-user">
          {user ? (
            <>
              <span>{user.username}{user.role === 'ADMIN' ? '（管理员）' : ''}</span>
              <button className="btn btn-sm" onClick={handleLogout}>退出</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-sm">登录</Link>
              <Link to="/register" className="btn btn-sm btn-primary">注册</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
