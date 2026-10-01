import { useState, useEffect } from 'react'

function App() {
  const [time, setTime] = useState(new Date())
  const [isVisible, setIsVisible] = useState(false)
  const [activeCard, setActiveCard] = useState<number | null>(null)

  useEffect(() => {
    setIsVisible(true)
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const greeting = () => {
    const hour = time.getHours()
    if (hour < 6) return '夜深了'
    if (hour < 9) return '早上好'
    if (hour < 12) return '上午好'
    if (hour < 14) return '中午好'
    if (hour < 18) return '下午好'
    if (hour < 22) return '晚上好'
    return '夜深了'
  }

  const features = [
    {
      icon: '🚀',
      title: '快速响应',
      description: '采用最新技术栈，确保页面加载速度和交互体验达到极致。',
    },
    {
      icon: '🎨',
      title: '精美设计',
      description: '现代化的UI设计语言，让每一个像素都恰到好处。',
    },
    {
      icon: '🔒',
      title: '安全可靠',
      description: '严格的安全标准和最佳实践，保护您的数据安全。',
    },
    {
      icon: '📱',
      title: '响应式布局',
      description: '完美适配各种设备和屏幕尺寸，随时随地畅享体验。',
    },
    {
      icon: '⚡',
      title: '高性能',
      description: '优化的渲染策略和代码分割，带来流畅的用户体验。',
    },
    {
      icon: '🌍',
      title: '国际化',
      description: '支持多语言环境，面向全球用户提供服务。',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden">
      {/* 背景动画粒子 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-purple-500/10 animate-pulse"
            style={{
              width: `${Math.random() * 300 + 50}px`,
              height: `${Math.random() * 300 + 50}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 10 + 5}s`,
            }}
          />
        ))}
      </div>

      {/* 导航栏 */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
        <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          ✨ 你好世界
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#home" className="hover:text-purple-300 transition-colors">首页</a>
          <a href="#features" className="hover:text-purple-300 transition-colors">功能</a>
          <a href="#about" className="hover:text-purple-300 transition-colors">关于</a>
          <button className="px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-full transition-all hover:scale-105 shadow-lg shadow-purple-500/25">
            开始使用
          </button>
        </div>
      </nav>

      {/* 主区域 */}
      <main className="relative z-10">
        {/* Hero Section */}
        <section id="home" className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
          <div
            className={`transition-all duration-1000 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
          >
            <div className="text-6xl md:text-8xl mb-6 animate-bounce">👋</div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
                {greeting()}
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-2xl mx-auto">
              欢迎来到这个美丽的页面
            </p>
            <p className="text-lg text-gray-400 mb-10 max-w-xl mx-auto">
              这是一个用 React + Tailwind CSS 构建的现代化欢迎页面
            </p>

            {/* 时间显示 */}
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-lg rounded-full border border-white/10 mb-10">
              <span className="text-purple-400">🕐</span>
              <span className="font-mono text-lg">
                {time.toLocaleTimeString('zh-CN', { hour12: false })}
              </span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-400">
                {time.toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full text-lg font-medium transition-all hover:scale-105 shadow-xl shadow-purple-500/25">
                探索更多 →
              </button>
              <button className="px-8 py-4 bg-white/5 hover:bg-white/10 backdrop-blur-lg border border-white/20 rounded-full text-lg font-medium transition-all hover:scale-105">
                了解更多
              </button>
            </div>
          </div>
        </section>

        {/* 功能卡片 */}
        <section id="features" className="py-20 px-6 md:px-12">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            核心功能
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
            我们提供全方位的解决方案，满足您的各种需求
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`group relative p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-purple-500/50 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/10 cursor-pointer ${
                  activeCard === index ? 'border-purple-500/50 bg-white/10' : ''
                }`}
                onMouseEnter={() => setActiveCard(index)}
                onMouseLeave={() => setActiveCard(null)}
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            ))}
          </div>
        </section>

        {/* 统计数据 */}
        <section className="py-20 px-6 md:px-12">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '10K+', label: '活跃用户' },
              { value: '99.9%', label: '正常运行时间' },
              { value: '50+', label: '功能模块' },
              { value: '24/7', label: '技术支持' },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section id="about" className="py-20 px-6 md:px-12">
          <div className="max-w-4xl mx-auto text-center p-12 md:p-16 rounded-3xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-white/10 backdrop-blur-sm">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">准备好开始了吗？</h2>
            <p className="text-gray-300 text-lg mb-8 max-w-xl mx-auto">
              加入我们，一起创造更美好的未来。无论你是开发者、设计师还是创业者，这里都有你需要的工具。
            </p>
            <button className="px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full text-lg font-medium transition-all hover:scale-105 shadow-xl shadow-purple-500/25">
              立即加入 🎉
            </button>
          </div>
        </section>
      </main>

      {/* 页脚 */}
      <footer className="relative z-10 border-t border-white/10 py-8 px-6 md:px-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-400">
            © 2026 你好世界. 用 ❤️ 构建
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">
              <i className="fab fa-github text-xl"></i>
            </a>
            <a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">
              <i className="fab fa-twitter text-xl"></i>
            </a>
            <a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">
              <i className="fab fa-weixin text-xl"></i>
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
