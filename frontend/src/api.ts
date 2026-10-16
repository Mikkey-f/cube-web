import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cube_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined
    if (data?.message) return data.message
    if (err.response?.status === 401) return '登录状态已失效，请重新登录'
    if (err.response?.status === 403) return '没有权限执行此操作'
    if (err.code === 'ERR_NETWORK') return '无法连接服务器，请确认后端已启动'
  }
  return '操作失败，请稍后重试'
}

export default api
