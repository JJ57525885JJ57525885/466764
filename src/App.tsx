import { useState, useEffect, useRef, useCallback } from 'react'

// ============ 类型定义 ============
interface Ant {
  id: number
  x: number
  y: number
  targetX: number
  targetY: number
  state: 'idle' | 'seeking' | 'carrying' | 'returning' | 'resting'
  type: 'worker' | 'soldier' | 'queen'
  energy: number
  age: number
  direction: number // 0-3 对应上下左右
  frame: number
  carryingFood: boolean
  speed: number
}

interface Food {
  id: number
  x: number
  y: number
  amount: number
  type: 'seed' | 'sugar' | 'insect'
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

interface GameState {
  ants: Ant[]
  foods: Food[]
  particles: Particle[]
  foodStored: number
  totalAnts: number
  day: number
  nestLevel: number
  selectedTool: 'food_seed' | 'food_sugar' | 'food_insect' | 'water' | 'none'
  message: string
  messageTimer: number
}

// ============ 常量 ============
const TILE_SIZE = 4
const WORLD_W = 200
const WORLD_H = 150
const NEST_CENTER_X = 100
const NEST_CENTER_Y = 90
const NEST_RADIUS = 25

// ============ 像素绘制工具 ============
function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h)
}

// 蚂蚁绘制在 drawPixelPixelAnt 函数中实现

function drawPixelFood(ctx: CanvasRenderingContext2D, x: number, y: number, type: string) {
  const s = TILE_SIZE
  if (type === 'seed') {
    drawPixelRect(ctx, x - s, y - s, s * 2, s * 2, '#8B4513')
    drawPixelRect(ctx, x - s, y - s, s, s, '#A0522D')
    drawPixelRect(ctx, x, y - s * 2, s, s, '#228B22')
  } else if (type === 'sugar') {
    drawPixelRect(ctx, x - s * 2, y - s, s * 4, s * 2, '#FFE4E1')
    drawPixelRect(ctx, x - s, y - s * 2, s * 2, s, '#FFF0F5')
    drawPixelRect(ctx, x - s, y + s, s * 2, s, '#FFB6C1')
  } else if (type === 'insect') {
    drawPixelRect(ctx, x - s * 2, y - s, s * 4, s * 2, '#556B2F')
    drawPixelRect(ctx, x - s, y - s * 2, s * 2, s, '#6B8E23')
    drawPixelRect(ctx, x - s * 3, y, s, s, '#556B2F')
    drawPixelRect(ctx, x + s * 2, y, s, s, '#556B2F')
  }
}

// ============ 主组件 ============
function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<GameState>({
    ants: [],
    foods: [],
    particles: [],
    foodStored: 20,
    totalAnts: 0,
    day: 1,
    nestLevel: 1,
    selectedTool: 'food_seed',
    message: '欢迎来到蚂蚁世界！点击地面放置食物来喂养蚂蚁吧~',
    messageTimer: 300,
  })
  const animFrameRef = useRef<number>(0)
  const tickRef = useRef<number>(0)
  const [, forceUpdate] = useState(0)
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showHelp, setShowHelp] = useState(false)

  // 初始化游戏
  const initGame = useCallback(() => {
    const game = gameRef.current
    game.ants = []
    game.foods = []
    game.particles = []
    game.foodStored = 20
    game.day = 1
    game.nestLevel = 1
    game.message = '欢迎来到蚂蚁世界！点击地面放置食物来喂养蚂蚁吧~'
    game.messageTimer = 300

    // 创建蚁后
    game.ants.push({
      id: 0,
      x: NEST_CENTER_X * TILE_SIZE,
      y: NEST_CENTER_Y * TILE_SIZE,
      targetX: NEST_CENTER_X * TILE_SIZE,
      targetY: NEST_CENTER_Y * TILE_SIZE,
      state: 'idle',
      type: 'queen',
      energy: 100,
      age: 0,
      direction: 0,
      frame: 0,
      carryingFood: false,
      speed: 0.3,
    })

    // 创建初始工蚁
    for (let i = 1; i <= 8; i++) {
      const angle = (Math.PI * 2 * i) / 8
      game.ants.push({
        id: i,
        x: NEST_CENTER_X * TILE_SIZE + Math.cos(angle) * 30,
        y: NEST_CENTER_Y * TILE_SIZE + Math.sin(angle) * 30,
        targetX: NEST_CENTER_X * TILE_SIZE + Math.cos(angle) * 60,
        targetY: NEST_CENTER_Y * TILE_SIZE + Math.sin(angle) * 60,
        state: 'idle',
        type: 'worker',
        energy: 80,
        age: 0,
        direction: Math.floor(Math.random() * 4),
        frame: 0,
        carryingFood: false,
        speed: 0.8 + Math.random() * 0.4,
      })
    }

    // 创建初始兵蚁
    for (let i = 9; i <= 10; i++) {
      const angle = (Math.PI * 2 * i) / 4
      game.ants.push({
        id: i,
        x: NEST_CENTER_X * TILE_SIZE + Math.cos(angle) * 20,
        y: NEST_CENTER_Y * TILE_SIZE + Math.sin(angle) * 20,
        targetX: NEST_CENTER_X * TILE_SIZE + Math.cos(angle) * 50,
        targetY: NEST_CENTER_Y * TILE_SIZE + Math.sin(angle) * 50,
        state: 'idle',
        type: 'soldier',
        energy: 100,
        age: 0,
        direction: Math.floor(Math.random() * 4),
        frame: 0,
        carryingFood: false,
        speed: 0.6 + Math.random() * 0.3,
      })
    }

    game.totalAnts = game.ants.length
    setCamera({
      x: NEST_CENTER_X * TILE_SIZE - 400,
      y: NEST_CENTER_Y * TILE_SIZE - 300,
    })
  }, [])

  useEffect(() => {
    initGame()
  }, [initGame])

  // 游戏逻辑更新
  const updateGame = useCallback(() => {
    const game = gameRef.current
    tickRef.current++

    // 消息计时
    if (game.messageTimer > 0) game.messageTimer--

    // 更新粒子
    game.particles = game.particles.filter((p) => {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.1
      p.life--
      return p.life > 0
    })

    // 天数计算
    if (tickRef.current % 1800 === 0) {
      game.day++
      // 每天消耗食物
      const consumption = game.ants.length
      game.foodStored = Math.max(0, game.foodStored - consumption)
      if (game.foodStored <= 0) {
        game.message = '⚠️ 食物不足！蚂蚁们要饿了！'
        game.messageTimer = 200
      }
    }

    // 蚁后繁殖
    const queen = game.ants.find((a) => a.type === 'queen')
    if (queen && game.foodStored >= 10 && tickRef.current % 600 === 0) {
      game.foodStored -= 5
      const newType = Math.random() < 0.2 ? 'soldier' : 'worker'
      const angle = Math.random() * Math.PI * 2
      const newAnt: Ant = {
        id: game.ants.length,
        x: queen.x + Math.cos(angle) * 10,
        y: queen.y + Math.sin(angle) * 10,
        targetX: NEST_CENTER_X * TILE_SIZE + Math.cos(angle) * 40,
        targetY: NEST_CENTER_Y * TILE_SIZE + Math.sin(angle) * 40,
        state: 'idle',
        type: newType,
        energy: 60,
        age: 0,
        direction: Math.floor(Math.random() * 4),
        frame: 0,
        carryingFood: false,
        speed: 0.7 + Math.random() * 0.5,
      }
      game.ants.push(newAnt)
      game.totalAnts = game.ants.length

      // 繁殖粒子效果
      for (let i = 0; i < 8; i++) {
        game.particles.push({
          x: queen.x,
          y: queen.y,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          life: 30,
          color: '#FFD700',
        })
      }

      if (game.totalAnts % 5 === 0) {
        game.message = `🎉 新蚂蚁诞生了！当前蚂蚁数量: ${game.totalAnts}`
        game.messageTimer = 150
      }
    }

    // 升级蚁巢
    if (game.totalAnts >= game.nestLevel * 10 + 5 && game.foodStored >= game.nestLevel * 20) {
      game.nestLevel++
      game.message = `🏰 蚁巢升级到 ${game.nestLevel} 级！`
      game.messageTimer = 200
    }

    // 更新蚂蚁AI
    game.ants.forEach((ant) => {
      ant.frame++
      ant.age++

      // 能量消耗
      if (tickRef.current % 120 === 0) {
        ant.energy = Math.max(0, ant.energy - 1)
        if (ant.energy <= 0 && ant.type !== 'queen') {
          ant.state = 'resting'
        }
      }

      // 休息恢复
      if (ant.state === 'resting') {
        ant.energy = Math.min(100, ant.energy + 0.5)
        if (ant.energy >= 50) ant.state = 'idle'
        return
      }

      // 移动逻辑
      const dx = ant.targetX - ant.x
      const dy = ant.targetY - ant.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > 3) {
        ant.x += (dx / dist) * ant.speed
        ant.y += (dy / dist) * ant.speed
        // 更新方向
        if (Math.abs(dx) > Math.abs(dy)) {
          ant.direction = dx > 0 ? 1 : 3
        } else {
          ant.direction = dy > 0 ? 2 : 0
        }
      } else {
        // 到达目标后选择新行为
        if (ant.type === 'queen') {
          // 蚁后在巢内缓慢移动
          ant.targetX = NEST_CENTER_X * TILE_SIZE + (Math.random() - 0.5) * 30
          ant.targetY = NEST_CENTER_Y * TILE_SIZE + (Math.random() - 0.5) * 30
        } else if (ant.state === 'carrying') {
          // 搬运食物回巢
          ant.targetX = NEST_CENTER_X * TILE_SIZE + (Math.random() - 0.5) * 20
          ant.targetY = NEST_CENTER_Y * TILE_SIZE + (Math.random() - 0.5) * 20
          if (dist < 20) {
            game.foodStored += 3
            ant.carryingFood = false
            ant.state = 'idle'
            // 存储食物粒子
            for (let i = 0; i < 5; i++) {
              game.particles.push({
                x: ant.x,
                y: ant.y,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 2,
                life: 20,
                color: '#90EE90',
              })
            }
          }
        } else {
          // 工蚁寻找食物
          if (game.foods.length > 0 && ant.type === 'worker') {
            // 找最近的食物
            let closestFood: Food | null = null
            let closestDist = Infinity
            game.foods.forEach((food) => {
              const fd = Math.sqrt(
                (food.x * TILE_SIZE - ant.x) ** 2 + (food.y * TILE_SIZE - ant.y) ** 2
              )
              if (fd < closestDist) {
                closestDist = fd
                closestFood = food
              }
            })
            if (closestFood) {
              const targetFood = closestFood as Food
              ant.targetX = targetFood.x * TILE_SIZE
              ant.targetY = targetFood.y * TILE_SIZE
              ant.state = 'seeking'

              // 到达食物
              if (closestDist < 10) {
                targetFood.amount--
                if (targetFood.amount <= 0) {
                  game.foods = game.foods.filter((f) => f.id !== targetFood.id)
                }
                ant.carryingFood = true
                ant.state = 'carrying'
                ant.targetX = NEST_CENTER_X * TILE_SIZE
                ant.targetY = NEST_CENTER_Y * TILE_SIZE
              }
            }
          } else {
            // 随机巡逻
            if (Math.random() < 0.02) {
              const patrolRadius = ant.type === 'soldier' ? NEST_RADIUS + 15 : NEST_RADIUS + 30
              const angle = Math.random() * Math.PI * 2
              const r = Math.random() * patrolRadius
              ant.targetX = NEST_CENTER_X * TILE_SIZE + Math.cos(angle) * r * TILE_SIZE
              ant.targetY = NEST_CENTER_Y * TILE_SIZE + Math.sin(angle) * r * TILE_SIZE
            }
          }
        }
      }
    })

    // 每30帧刷新一次React状态
    if (tickRef.current % 30 === 0) {
      forceUpdate((v) => v + 1)
    }
  }, [])

  // 渲染游戏
  const renderGame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const game = gameRef.current
    const cam = camera

    ctx.imageSmoothingEnabled = false

    // 清屏 - 土壤背景
    ctx.fillStyle = '#2d1b0e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 绘制土壤纹理
    for (let x = 0; x < canvas.width; x += 8) {
      for (let y = 0; y < canvas.height; y += 8) {
        const worldX = x + cam.x
        const worldY = y + cam.y
        const noise = Math.sin(worldX * 0.05) * Math.cos(worldY * 0.05)
        if (noise > 0.3) {
          ctx.fillStyle = '#3d2b1e'
          ctx.fillRect(x, y, 4, 4)
        } else if (noise < -0.3) {
          ctx.fillStyle = '#1d0b00'
          ctx.fillRect(x, y, 4, 4)
        }
      }
    }

    // 绘制蚁巢区域
    const nestScreenX = NEST_CENTER_X * TILE_SIZE - cam.x
    const nestScreenY = NEST_CENTER_Y * TILE_SIZE - cam.y
    const nestR = (NEST_RADIUS + game.nestLevel * 3) * TILE_SIZE

    // 蚁巢外圈
    ctx.beginPath()
    ctx.arc(nestScreenX, nestScreenY, nestR + 8, 0, Math.PI * 2)
    ctx.fillStyle = '#4a3520'
    ctx.fill()

    // 蚁巢内部
    ctx.beginPath()
    ctx.arc(nestScreenX, nestScreenY, nestR, 0, Math.PI * 2)
    ctx.fillStyle = '#5c4033'
    ctx.fill()

    // 蚁巢通道纹理
    for (let i = 0; i < 6 + game.nestLevel * 2; i++) {
      const angle = (Math.PI * 2 * i) / (6 + game.nestLevel * 2)
      const r = nestR * 0.6
      const tx = nestScreenX + Math.cos(angle) * r
      const ty = nestScreenY + Math.sin(angle) * r
      ctx.beginPath()
      ctx.arc(tx, ty, 8 + game.nestLevel, 0, Math.PI * 2)
      ctx.fillStyle = '#3d2517'
      ctx.fill()
    }

    // 蚁巢中心 - 蚁后房间
    ctx.beginPath()
    ctx.arc(nestScreenX, nestScreenY, 20 + game.nestLevel * 2, 0, Math.PI * 2)
    ctx.fillStyle = '#6b4423'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(nestScreenX, nestScreenY, 12 + game.nestLevel, 0, Math.PI * 2)
    ctx.fillStyle = '#8B6914'
    ctx.fill()

    // 绘制食物存储指示
    const storageBars = Math.min(10, Math.floor(game.foodStored / 5))
    for (let i = 0; i < storageBars; i++) {
      const angle = (Math.PI * 2 * i) / 10
      const r = 25 + game.nestLevel * 2
      const sx = nestScreenX + Math.cos(angle) * r
      const sy = nestScreenY + Math.sin(angle) * r
      drawPixelRect(ctx, sx - 2, sy - 2, 4, 4, '#90EE90')
    }

    // 绘制食物
    game.foods.forEach((food) => {
      const fx = food.x * TILE_SIZE - cam.x
      const fy = food.y * TILE_SIZE - cam.y
      if (fx > -50 && fx < canvas.width + 50 && fy > -50 && fy < canvas.height + 50) {
        drawPixelFood(ctx, fx, fy, food.type)
        // 食物量指示
        const barW = food.amount * 2
        drawPixelRect(ctx, fx - 8, fy + 10, barW, 3, '#4CAF50')
        drawPixelRect(ctx, fx - 8, fy + 10, 20, 3, 'rgba(255,255,255,0.2)')
      }
    })

    // 绘制蚂蚁
    game.ants.forEach((ant) => {
      const ax = ant.x - cam.x
      const ay = ant.y - cam.y
      if (ax > -30 && ax < canvas.width + 30 && ay > -30 && ay < canvas.height + 30) {
        drawPixelPixelAnt(ctx, ax, ay, ant.direction, ant.frame, ant.type, ant.carryingFood)
      }
    })

    // 绘制粒子
    game.particles.forEach((p) => {
      const px = p.x - cam.x
      const py = p.y - cam.y
      ctx.globalAlpha = p.life / 30
      drawPixelRect(ctx, px, py, 3, 3, p.color)
    })
    ctx.globalAlpha = 1

    // 绘制网格参考线（淡淡的）
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 1
    for (let x = -cam.x % 40; x < canvas.width; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }
    for (let y = -cam.y % 40; y < canvas.height; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }
  }, [camera])

  // Canvas 自适应大小
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const parent = canvas.parentElement
      if (!parent) return
      canvas.width = parent.clientWidth
      canvas.height = parent.clientHeight
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 游戏循环
  useEffect(() => {
    const loop = () => {
      updateGame()
      renderGame()
      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [updateGame, renderGame])

  // 点击放置食物
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return
    const canvas = canvasRef.current
    if (!canvas) return
    const game = gameRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clickX = (e.clientX - rect.left) * scaleX + camera.x
    const clickY = (e.clientY - rect.top) * scaleY + camera.y
    const worldX = Math.floor(clickX / TILE_SIZE)
    const worldY = Math.floor(clickY / TILE_SIZE)

    if (game.selectedTool === 'food_seed') {
      game.foods.push({
        id: Date.now(),
        x: worldX,
        y: worldY,
        amount: 8,
        type: 'seed',
      })
      game.message = '🌱 放置了种子！工蚁会来搬运的'
      game.messageTimer = 100
    } else if (game.selectedTool === 'food_sugar') {
      game.foods.push({
        id: Date.now(),
        x: worldX,
        y: worldY,
        amount: 12,
        type: 'sugar',
      })
      game.message = '🍬 放置了糖分！蚂蚁们最爱甜食'
      game.messageTimer = 100
    } else if (game.selectedTool === 'food_insect') {
      game.foods.push({
        id: Date.now(),
        x: worldX,
        y: worldY,
        amount: 15,
        type: 'insect',
      })
      game.message = '🦗 放置了昆虫！高蛋白食物'
      game.messageTimer = 100
    } else if (game.selectedTool === 'water') {
      // 浇水恢复能量
      game.ants.forEach((ant) => {
        const dist = Math.sqrt((ant.x - clickX) ** 2 + (ant.y - clickY) ** 2)
        if (dist < 60) {
          ant.energy = Math.min(100, ant.energy + 30)
          game.particles.push({
            x: ant.x,
            y: ant.y,
            vx: 0,
            vy: -1,
            life: 20,
            color: '#87CEEB',
          })
        }
      })
      game.message = '💧 浇水成功！附近蚂蚁恢复了体力'
      game.messageTimer = 100
    }

    forceUpdate((v) => v + 1)
  }

  // 拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2 || e.button === 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - camera.x, y: e.clientY - camera.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setCamera({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const game = gameRef.current

  return (
    <div className="w-full h-screen bg-[#1a0f0a] flex flex-col overflow-hidden select-none"
      style={{ fontFamily: '"Courier New", monospace', imageRendering: 'pixelated' }}>
      
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d1b0e] border-b-2 border-[#4a3520]">
        <div className="flex items-center gap-4">
          <span className="text-[#daa520] text-lg font-bold tracking-wider">🐜 蚂蚁饲养员</span>
          <span className="text-[#8B6914] text-sm">第 {game.day} 天</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span className="text-[#90EE90]">🍖 食物储备: {game.foodStored}</span>
          <span className="text-[#FFB6C1]">🐜 蚂蚁数量: {game.totalAnts}</span>
          <span className="text-[#87CEEB]">🏰 蚁巢等级: {game.nestLevel}</span>
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="px-3 py-1 bg-[#4a3520] text-[#daa520] border border-[#6b4423] hover:bg-[#5c4033] text-sm"
        >
          ? 帮助
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧工具栏 */}
        <div className="w-48 bg-[#2d1b0e] border-r-2 border-[#4a3520] p-3 flex flex-col gap-2">
          <div className="text-[#daa520] text-sm font-bold mb-2 border-b border-[#4a3520] pb-1">
            🔧 工具栏
          </div>
          
          {[
            { tool: 'food_seed' as const, icon: '🌱', name: '种子', desc: '食物+8' },
            { tool: 'food_sugar' as const, icon: '🍬', name: '糖分', desc: '食物+12' },
            { tool: 'food_insect' as const, icon: '🦗', name: '昆虫', desc: '食物+15' },
            { tool: 'water' as const, icon: '💧', name: '浇水', desc: '恢复体力' },
          ].map(({ tool, icon, name, desc }) => (
            <button
              key={tool}
              onClick={() => {
                game.selectedTool = tool
                forceUpdate((v) => v + 1)
              }}
              className={`flex items-center gap-2 px-3 py-2 text-left text-sm border transition-all ${
                game.selectedTool === tool
                  ? 'bg-[#5c4033] border-[#daa520] text-[#daa520]'
                  : 'bg-[#3d2517] border-[#4a3520] text-[#a08060] hover:bg-[#4a3520]'
              }`}
            >
              <span className="text-lg">{icon}</span>
              <div>
                <div className="font-bold">{name}</div>
                <div className="text-xs opacity-70">{desc}</div>
              </div>
            </button>
          ))}

          <div className="mt-4 border-t border-[#4a3520] pt-3">
            <div className="text-[#daa520] text-xs font-bold mb-2">📊 统计</div>
            <div className="text-[#a08060] text-xs space-y-1">
              <div>工蚁: {game.ants.filter((a) => a.type === 'worker').length}</div>
              <div>兵蚁: {game.ants.filter((a) => a.type === 'soldier').length}</div>
              <div>蚁后: {game.ants.filter((a) => a.type === 'queen').length}</div>
              <div>搬运中: {game.ants.filter((a) => a.state === 'carrying').length}</div>
              <div>觅食中: {game.ants.filter((a) => a.state === 'seeking').length}</div>
            </div>
          </div>

          <div className="mt-auto">
            <button
              onClick={initGame}
              className="w-full px-3 py-2 bg-[#8b0000] text-white border border-[#a52a2a] hover:bg-[#a52a2a] text-sm font-bold"
            >
              🔄 重新开始
            </button>
          </div>
        </div>

        {/* 游戏画布 */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-full cursor-crosshair"
            style={{ imageRendering: 'pixelated' }}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onContextMenu={(e) => e.preventDefault()}
          />

          {/* 消息提示 */}
          {game.messageTimer > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-[#2d1b0e]/90 border-2 border-[#daa520] text-[#daa520] text-sm font-bold animate-pulse">
              {game.message}
            </div>
          )}

          {/* 帮助面板 */}
          {showHelp && (
            <div className="absolute inset-4 bg-[#2d1b0e]/95 border-2 border-[#daa520] p-6 overflow-auto">
              <div className="text-[#daa520] text-xl font-bold mb-4">📖 游戏指南</div>
              <div className="text-[#a08060] text-sm space-y-3">
                <p>🐜 <strong className="text-[#daa520]">目标：</strong>饲养你的蚂蚁 colony，让它们繁荣壮大！</p>
                <p>🌱 <strong className="text-[#daa520]">喂食：</strong>选择食物工具，点击地图放置食物。工蚁会自动搬运回巢。</p>
                <p>💧 <strong className="text-[#daa520]">浇水：</strong>点击蚂蚁附近区域，恢复它们的体力。</p>
                <p>👑 <strong className="text-[#daa520]">繁殖：</strong>食物充足时，蚁后会自动繁殖新蚂蚁。</p>
                <p>🏰 <strong className="text-[#daa520]">升级：</strong>蚂蚁数量达到条件后，蚁巢自动升级。</p>
                <p>🖱️ <strong className="text-[#daa520]">操作：</strong>右键/中键拖拽移动视角，左键放置物品。</p>
                <hr className="border-[#4a3520]" />
                <p>⚔️ <strong className="text-[#daa520]">蚂蚁类型：</strong></p>
                <p>• 工蚁（棕色）- 负责搬运食物</p>
                <p>• 兵蚁（红色）- 巡逻保护蚁巢</p>
                <p>• 蚁后（金色）- 繁殖新蚂蚁</p>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="mt-4 px-4 py-2 bg-[#4a3520] text-[#daa520] border border-[#6b4423] hover:bg-[#5c4033]"
              >
                关闭
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 底部信息栏 */}
      <div className="px-4 py-1 bg-[#2d1b0e] border-t-2 border-[#4a3520] flex items-center justify-between text-xs text-[#6b4423]">
        <span>左键放置 | 右键拖拽视角</span>
        <span>像素蚂蚁饲养 v1.0 | 用 ❤️ 制作</span>
      </div>
    </div>
  )
}

// 绘制像素蚂蚁的辅助函数
function drawPixelPixelAnt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: number,
  frame: number,
  type: string,
  carrying: boolean
) {
  const s = 2
  const colors: Record<string, { body: string; head: string; legs: string; accent: string }> = {
    worker: { body: '#5c3a1e', head: '#7a4e2a', legs: '#3d2510', accent: '#8B6914' },
    soldier: { body: '#8b2020', head: '#a53030', legs: '#6b1010', accent: '#ff4444' },
    queen: { body: '#8b7514', head: '#b8960a', legs: '#6b5510', accent: '#FFD700' },
  }
  const c = colors[type] || colors.worker
  const legAnim = Math.floor(frame / 8) % 2

  ctx.save()
  ctx.translate(Math.floor(x), Math.floor(y))

  // 根据方向旋转
  if (direction === 0) ctx.rotate(-Math.PI / 2)
  else if (direction === 2) ctx.rotate(Math.PI / 2)
  else if (direction === 3) ctx.scale(-1, 1)

  // 触角
  ctx.fillStyle = c.head
  ctx.fillRect(-s * 4, -s * 2, s, s * 2)
  ctx.fillRect(-s * 4, s, s, s * 2)

  // 头
  ctx.fillStyle = c.head
  ctx.fillRect(-s * 3, -s * 2, s * 3, s * 4)
  // 眼睛
  ctx.fillStyle = '#fff'
  ctx.fillRect(-s * 3, -s, s, s)
  ctx.fillStyle = '#000'
  ctx.fillRect(-s * 3, -s + 1, 1, 1)

  // 胸部
  ctx.fillStyle = c.body
  ctx.fillRect(0, -s * 1.5, s * 3, s * 3)

  // 腹部
  ctx.fillStyle = c.body
  ctx.fillRect(s * 3, -s * 2.5, s * 4, s * 5)
  ctx.fillStyle = c.accent
  ctx.fillRect(s * 4, -s * 1.5, s * 2, s * 3)

  // 腿
  ctx.fillStyle = c.legs
  const lOff = legAnim * s
  ctx.fillRect(-s, s * 2 + lOff, s, s * 3)
  ctx.fillRect(s * 1, s * 2 - lOff, s, s * 3)
  ctx.fillRect(s * 3, s * 2 + lOff, s, s * 3)
  // 上方腿
  ctx.fillRect(-s, -s * 3 - lOff, s, s * 2)
  ctx.fillRect(s * 1, -s * 3 + lOff, s, s * 2)
  ctx.fillRect(s * 3, -s * 3 - lOff, s, s * 2)

  // 搬运食物
  if (carrying) {
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(-s * 5, -s * 2, s * 2, s * 3)
    ctx.fillStyle = '#A0522D'
    ctx.fillRect(-s * 5, -s * 2, s * 2, s)
  }

  ctx.restore()
}

export default App
