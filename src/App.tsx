import { useState, useEffect, useRef, useCallback } from 'react'

// ============ 类型定义 ============
interface Ant {
  id: number
  x: number
  y: number
  targetX: number
  targetY: number
  state: 'idle' | 'seeking' | 'carrying' | 'feeding_queen' | 'resting' | 'dead' | 'flying' | 'mating'
  type: 'worker' | 'soldier' | 'queen' | 'male' | 'female'
  energy: number
  age: number
  maxAge: number // 寿命上限（帧数）
  direction: number // 0=上, 1=右, 2=下, 3=左
  frame: number
  carryingFood: boolean
  speed: number
  hasWings?: boolean
  isMated?: boolean // 雌蚁是否已交配
}

interface Egg {
  id: number
  x: number
  y: number
  hatchTimer: number // 孵化倒计时
  type: 'worker' | 'soldier' | 'male' | 'female'
}

interface Larva {
  id: number
  x: number
  y: number
  type: 'worker' | 'soldier' | 'male' | 'female'
  foodReceived: number
  foodRequired: number // 工蚁5，兵蚁8，繁殖蚁3
  frame: number
}

interface Cocoon {
  id: number
  x: number
  y: number
  type: 'worker' | 'soldier' | 'male' | 'female'
  hatchTimer: number // 孵化倒计时
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
  maxLife: number
  color: string
}

interface Cricket {
  id: number
  x: number
  y: number
  targetX: number
  targetY: number
  hp: number
  maxHp: number
  direction: number
  frame: number
  speed: number
  jumpTimer: number
}

interface GameState {
  ants: Ant[]
  eggs: Egg[]
  larvas: Larva[]
  cocoons: Cocoon[]
  foods: Food[]
  particles: Particle[]
  crickets: Cricket[]
  foodStored: number
  foodForQueen: number // 给蚁后的食物计数
  totalAnts: number
  day: number
  nestLevel: number
  selectedTool: 'food_seed' | 'food_sugar' | 'food_insect' | 'water' | 'cricket' | 'catch' | 'none'
  message: string
  messageTimer: number
  queenHunger: number // 蚁后饥饿值 0-100
  nextAntId: number
  nextCricketId: number
  nextLarvaId: number
  nextCocoonId: number
  currentScene: 'nest' | 'wild' // 当前场景
  wildAnts: Ant[] // 野外的蚂蚁
  wildQueens: Ant[] // 野外可捕捉的蚁后
}

// ============ 常量 ============
const TILE_SIZE = 4
const NEST_CENTER_X = 100
const NEST_CENTER_Y = 90
const NEST_RADIUS = 25
const WORKER_MAX_AGE = 5400 // 工蚁寿命约90秒（60fps）
const SOLDIER_MAX_AGE = 7200 // 兵蚁寿命约120秒
const EGG_HATCH_TIME = 600 // 卵孵化时间10秒
const FOOD_PER_EGG = 5 // 5个食物产1个卵
const CAMERA_SPEED = 8 // 键盘/边缘滚动速度
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const EDGE_SCROLL_THRESHOLD = 50 // 边缘滚动触发距离

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

// ============ 绘制横向蚂蚁 ============
// 蚂蚁默认朝右（水平方向），通过旋转适配不同方向
function drawPixelAnt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: number,
  frame: number,
  type: string,
  carrying: boolean,
  hasWings: boolean = false
) {
  const s = 2
  const colors: Record<string, { body: string; head: string; legs: string; accent: string }> = {
    worker: { body: '#5c3a1e', head: '#7a4e2a', legs: '#3d2510', accent: '#8B6914' },
    soldier: { body: '#8b2020', head: '#a53030', legs: '#6b1010', accent: '#ff4444' },
    queen: { body: '#8b7514', head: '#b8960a', legs: '#6b5510', accent: '#FFD700' },
    male: { body: '#2c2c2c', head: '#3c3c3c', legs: '#1c1c1c', accent: '#4c4c4c' },
    female: { body: '#4a2c5e', head: '#5a3c6e', legs: '#3a1c4e', accent: '#6a4c7e' },
  }
  const c = colors[type] || colors.worker
  const legAnim = Math.floor(frame / 6) % 2
  const isQueen = type === 'queen'
  const isSoldier = type === 'soldier'
  const isReproductive = type === 'male' || type === 'female'
  const scale = isQueen ? 1.8 : isReproductive ? 1.2 : 1
  
  // 兵蚁头部更宽
  const headWidth = isSoldier ? 5 : 4
  const headHeight = isSoldier ? 4 : 3

  ctx.save()
  ctx.translate(Math.floor(x), Math.floor(y))
  ctx.scale(scale, scale)

  // 根据方向旋转 - 蚂蚁默认头朝左
  // direction: 0=上, 1=右, 2=下, 3=左
  if (direction === 0) ctx.rotate(Math.PI / 2)        // 朝上：顺时针90度（头从左转到上）
  else if (direction === 2) ctx.rotate(-Math.PI / 2)  // 朝下：逆时针90度（头从左转到下）
  else if (direction === 1) ctx.scale(-1, 1)          // 朝右：翻转使头朝右（朝前）
  // direction === 3 朝左：不翻转，头默认朝左（朝前）

  // === 横向蚂蚁绘制（头在左，腹部在右，身体水平）===
  
  // 触角（从头部前方伸出，水平方向）
  ctx.fillStyle = c.head
  ctx.fillRect(-s * 6, -s * 2, s * 2, s)  // 上触角
  ctx.fillRect(-s * 6, s * 1, s * 2, s)   // 下触角
  ctx.fillRect(-s * 7, -s * 3, s, s)      // 触角尖端
  ctx.fillRect(-s * 7, s * 2, s, s)       // 触角尖端

  // 头部（横向椭圆：宽>高）
  ctx.fillStyle = c.head
  ctx.fillRect(-s * headWidth, -s * (headHeight / 2), s * headWidth, s * headHeight)  // 头部主体（横向）
  ctx.fillRect(-s * (headWidth + 1), -s * (headHeight / 4), s * 2, s * (headHeight / 2))  // 头部前端
  
  // 眼睛（在头部两侧）
  ctx.fillStyle = '#fff'
  ctx.fillRect(-s * headWidth, -s * (headHeight / 2), s, s)  // 上眼
  ctx.fillRect(-s * headWidth, s * (headHeight / 2 - 1), s, s)   // 下眼
  ctx.fillStyle = '#000'
  ctx.fillRect(-s * headWidth, -s * (headHeight / 2 - 0.5), 1, 1)    // 瞳孔
  ctx.fillRect(-s * headWidth, s * (headHeight / 2 - 1), 1, 1)   // 瞳孔
  
  // 大颚（头部最前方）- 兵蚁的大颚更大
  ctx.fillStyle = isSoldier ? '#ff0000' : c.head
  const mandibleSize = isSoldier ? 1.5 : 1
  ctx.fillRect(-s * (headWidth + 1.5), -s * 0.5, s * mandibleSize, s * 0.5)
  ctx.fillRect(-s * (headWidth + 1.5), 0, s * mandibleSize, s * 0.5)

  // 胸部（横向连接）
  ctx.fillStyle = c.body
  ctx.fillRect(-s * 0.5, -s * 1, s * 3, s * 2)

  // 腰部（细连接）
  ctx.fillStyle = c.body
  ctx.fillRect(s * 2.5, -s * 0.5, s * 1.5, s)

  // 腹部（横向椭圆，蚁后更大更长）
  ctx.fillStyle = c.body
  if (isQueen) {
    // 蚁后腹部：更宽更长
    ctx.fillRect(s * 4, -s * 2.5, s * 8, s * 5)    // 腹部主体（横向长）
    ctx.fillRect(s * 5, -s * 3, s * 6, s * 6)      // 腹部加宽
    ctx.fillRect(s * 10, -s * 2, s * 2, s * 4)     // 腹部末端
    // 腹部花纹
    ctx.fillStyle = c.accent
    ctx.fillRect(s * 6, -s * 1.5, s * 2, s * 3)
    ctx.fillRect(s * 9, -s * 1, s * 1.5, s * 2)
  } else {
    // 普通蚂蚁腹部
    ctx.fillRect(s * 4, -s * 1.5, s * 5, s * 3)    // 腹部主体
    ctx.fillRect(s * 5, -s * 2, s * 3, s * 4)      // 腹部加宽
    // 腹部花纹
    ctx.fillStyle = c.accent
    ctx.fillRect(s * 5.5, -s * 0.5, s * 2, s)
  }

  // 腿（3对，在身体下方，水平排列）
  ctx.fillStyle = c.legs
  const lOff = legAnim * s
  // 前腿
  ctx.fillRect(-s * 0.5, s * 1.5 + lOff, s, s * 2)
  ctx.fillRect(-s * 0.5, -s * 2.5 - lOff, s, s * 2)
  // 中腿
  ctx.fillRect(s * 1.5, s * 1.5 - lOff, s, s * 2)
  ctx.fillRect(s * 1.5, -s * 2.5 + lOff, s, s * 2)
  // 后腿
  ctx.fillRect(s * 3.5, s * 1.5 + lOff, s, s * 2)
  ctx.fillRect(s * 3.5, -s * 2.5 - lOff, s, s * 2)

  // 翅膀（繁殖蚁有翅膀）
  if (hasWings) {
    const wingAnim = Math.sin(frame * 0.3) * 2 // 翅膀扇动动画
    ctx.fillStyle = 'rgba(200, 220, 255, 0.6)' // 半透明翅膀
    // 上翅膀
    ctx.fillRect(-s * 1, -s * 4 - wingAnim, s * 6, s * 2)
    ctx.fillRect(s * 1, -s * 5 - wingAnim, s * 4, s * 2)
    // 下翅膀
    ctx.fillRect(-s * 1, s * 2 + wingAnim, s * 6, s * 2)
    ctx.fillRect(s * 1, s * 3 + wingAnim, s * 4, s * 2)
  }

  // 搬运食物（在头部前方）
  if (carrying) {
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(-s * 7, -s * 1.5, s * 2, s * 2)
    ctx.fillStyle = '#A0522D'
    ctx.fillRect(-s * 7, -s * 1.5, s * 2, s)
  }

  ctx.restore()
}

// 绘制卵
function drawEgg(ctx: CanvasRenderingContext2D, x: number, y: number, hatchTimer: number) {
  const progress = 1 - hatchTimer / EGG_HATCH_TIME
  const s = 2
  
  // 卵的形状（椭圆形）
  ctx.fillStyle = progress < 0.7 ? '#FFFACD' : '#FFE4B5'
  ctx.fillRect(x - s * 2, y - s, s * 4, s * 2)
  ctx.fillRect(x - s, y - s * 2, s * 2, s * 4)
  
  // 孵化进度指示
  if (progress > 0.5) {
    ctx.fillStyle = '#DEB887'
    ctx.fillRect(x - s, y - s, s * 2, s * 2)
  }
  if (progress > 0.8) {
    // 快要孵化时出现裂纹
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(x, y - s * 2, 1, s)
    ctx.fillRect(x - s, y, 1, s)
  }
}

// 绘制幼虫
function drawLarva(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, type: 'worker' | 'soldier' | 'male' | 'female', foodReceived: number, foodRequired: number) {
  const s = 2
  const wiggle = Math.sin(frame * 0.1) * 1
  
  // 幼虫身体（弯曲的白色/米色虫子）
  ctx.fillStyle = type === 'worker' ? '#FFF8DC' : '#FFE4C4'
  
  // 身体分段，有弯曲效果
  ctx.fillRect(x - s * 3, y - s + wiggle, s * 2, s * 2)
  ctx.fillRect(x - s * 1.5, y - s * 1.5 - wiggle, s * 2, s * 3)
  ctx.fillRect(x + s * 0.5, y - s + wiggle, s * 2, s * 2)
  ctx.fillRect(x + s * 2, y - s * 0.5 - wiggle, s * 1.5, s)
  
  // 头部（稍大）
  ctx.fillStyle = type === 'worker' ? '#FAEBD7' : '#FFDAB9'
  ctx.fillRect(x - s * 4, y - s * 1.5 + wiggle, s * 2, s * 3)
  
  // 小嘴巴
  ctx.fillStyle = '#8B4513'
  ctx.fillRect(x - s * 4.5, y - s * 0.5 + wiggle, s * 0.5, s)
  
  // 喂食进度指示（小圆点）
  const dotSpacing = 4
  const startX = x - s * 2
  const startY = y - s * 3
  for (let i = 0; i < foodRequired; i++) {
    const dotX = startX + i * dotSpacing
    if (i < foodReceived) {
      ctx.fillStyle = '#4CAF50' // 已喂食
    } else {
      ctx.fillStyle = '#666' // 未喂食
    }
    ctx.fillRect(dotX, startY, 2, 2)
  }
}

// 绘制茧
function drawCocoon(ctx: CanvasRenderingContext2D, x: number, y: number, type: 'worker' | 'soldier' | 'male' | 'female', hatchTimer: number) {
  const s = 2
  const progress = 1 - hatchTimer / 600
  
  // 茧的颜色（橙色）
  const baseColor = type === 'worker' ? '#FF8C00' : '#FF6347'
  const darkColor = type === 'worker' ? '#D2691E' : '#CD5C5C'
  
  // 茧的形状（大椭圆）
  const width = type === 'worker' ? s * 5 : s * 6
  const height = type === 'worker' ? s * 3 : s * 4
  
  ctx.fillStyle = baseColor
  ctx.fillRect(x - width / 2, y - height / 2, width, height)
  
  // 茧的纹理
  ctx.fillStyle = darkColor
  ctx.fillRect(x - width / 2 + 2, y - height / 2 + 2, width - 4, 2)
  ctx.fillRect(x - width / 2 + 2, y + height / 2 - 4, width - 4, 2)
  
  // 孵化进度（裂纹）
  if (progress > 0.7) {
    ctx.fillStyle = '#000'
    ctx.fillRect(x - 2, y - height / 2, 1, height * 0.3)
    ctx.fillRect(x + 1, y - height / 2 + 2, 1, height * 0.2)
  }
}

// 绘制蟋蟀
function drawCricket(ctx: CanvasRenderingContext2D, x: number, y: number, direction: number, frame: number, hp: number, maxHp: number) {
  const s = 2
  const legAnim = Math.floor(frame / 4) % 2
  const jumpOffset = Math.sin(frame * 0.2) * 2
  
  
  ctx.save()
  ctx.translate(Math.floor(x), Math.floor(y) - jumpOffset)
  
  // 根据方向翻转
  if (direction === 3) ctx.scale(-1, 1) // 朝左时翻转
  
  // 蟋蟀身体（横向，头在右）
  // 触角
  ctx.fillStyle = '#2d4a1e'
  ctx.fillRect(s * 5, -s * 2, s * 3, s)
  ctx.fillRect(s * 5, s * 1, s * 3, s)
  ctx.fillRect(s * 7, -s * 3, s, s)
  ctx.fillRect(s * 7, s * 2, s, s)
  
  // 头部
  ctx.fillStyle = '#3d5a2e'
  ctx.fillRect(s * 3, -s * 1.5, s * 3, s * 3)
  
  // 眼睛
  ctx.fillStyle = '#ff0000'
  ctx.fillRect(s * 4, -s, s, s)
  ctx.fillRect(s * 4, 0, s, s)
  
  // 胸部
  ctx.fillStyle = '#4a6b3a'
  ctx.fillRect(s * 0.5, -s * 1, s * 3, s * 2)
  
  // 腹部（大椭圆）
  ctx.fillStyle = '#3d5a2e'
  ctx.fillRect(-s * 4, -s * 2, s * 5, s * 4)
  ctx.fillRect(-s * 5, -s * 1.5, s * 2, s * 3)
  
  // 腹部花纹
  ctx.fillStyle = '#2d4a1e'
  ctx.fillRect(-s * 3, -s * 0.5, s * 3, s)
  
  // 后腿（强壮的跳跃腿）
  ctx.fillStyle = '#4a6b3a'
  const legOff = legAnim * s
  // 右后腿
  ctx.fillRect(-s * 2, s * 2 + legOff, s * 2, s)
  ctx.fillRect(-s * 1, s * 3 + legOff, s, s * 2)
  ctx.fillRect(-s * 2, s * 4 + legOff, s * 2, s)
  // 左后腿
  ctx.fillRect(-s * 2, -s * 3 - legOff, s * 2, s)
  ctx.fillRect(-s * 1, -s * 5 - legOff, s, s * 2)
  ctx.fillRect(-s * 2, -s * 5 - legOff, s * 2, s)
  
  // 前腿和中腿
  ctx.fillRect(s * 1, s * 1.5, s, s * 2)
  ctx.fillRect(s * 1, -s * 2.5, s, s * 2)
  ctx.fillRect(s * 2.5, s * 1.5, s, s * 2)
  ctx.fillRect(s * 2.5, -s * 2.5, s, s * 2)
  
  ctx.restore()
  
  // 血条
  if (hp < maxHp) {
    const barWidth = 20
    const barX = x - barWidth / 2
    const barY = y - 18
    ctx.fillStyle = '#333'
    ctx.fillRect(barX, barY, barWidth, 3)
    ctx.fillStyle = hp > maxHp * 0.5 ? '#44ff44' : hp > maxHp * 0.25 ? '#ffaa00' : '#ff4444'
    ctx.fillRect(barX, barY, (hp / maxHp) * barWidth, 3)
  }
}

// ============ 主组件 ============
function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<GameState>({
    ants: [],
    eggs: [],
    larvas: [],
    cocoons: [],
    foods: [],
    particles: [],
    crickets: [],
    foodStored: 0,
    foodForQueen: 0,
    totalAnts: 0,
    day: 1,
    nestLevel: 1,
    selectedTool: 'food_seed',
    message: '🐜 欢迎来到蚂蚁世界！点击蚁后巢穴放置食物开始游戏~',
    messageTimer: 300,
    queenHunger: 50,
    nextAntId: 1,
    nextCricketId: 1,
    nextLarvaId: 1,
    nextCocoonId: 1,
    currentScene: 'nest',
    wildAnts: [],
    wildQueens: [],
  })
  const animFrameRef = useRef<number>(0)
  const tickRef = useRef<number>(0)
  const [, forceUpdate] = useState(0)
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showHelp, setShowHelp] = useState(false)
  const [showMinimap, setShowMinimap] = useState(true)
  const keysPressed = useRef<Set<string>>(new Set())
  const mousePosition = useRef({ x: -1000, y: -1000 }) // 初始值设为画布外，避免触发边缘滚动
  const touchStartRef = useRef<{ x: number; y: number; dist: number } | null>(null)

  // 初始化游戏
  const initGame = useCallback(() => {
    const game = gameRef.current
    game.ants = []
    game.eggs = []
    game.larvas = []
    game.cocoons = []
    game.foods = []
    game.particles = []
    game.crickets = []
    game.foodStored = 0
    game.foodForQueen = 0
    game.day = 1
    game.nestLevel = 1
    game.message = '🐜 欢迎来到蚂蚁世界！点击蚁后附近放置食物，蚁后会自己吃~'
    game.messageTimer = 300
    game.queenHunger = 50
    game.nextAntId = 1
    game.nextCricketId = 1
    game.nextLarvaId = 1
    game.nextCocoonId = 1
    game.currentScene = 'nest'
    game.wildAnts = []
    game.wildQueens = []

    // 只创建蚁后（在巢穴区域内缓慢移动）
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
      maxAge: Infinity, // 蚁后永生
      direction: 1, // 朝右
      frame: 0,
      carryingFood: false,
      speed: 0.5, // 蚁后移动速度（增加到0.5）
      hasWings: false,
      isMated: false,
    })

    game.totalAnts = game.ants.length
    setCamera({
      x: NEST_CENTER_X * TILE_SIZE - 400,
      y: NEST_CENTER_Y * TILE_SIZE - 300,
    })
  }, [])

  useEffect(() => {
    initGame()
  }, [initGame])

  // 键盘控制
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase())
      // 空格键回到中心
      if (e.key === ' ') {
        e.preventDefault()
        setCamera({
          x: NEST_CENTER_X * TILE_SIZE - 400,
          y: NEST_CENTER_Y * TILE_SIZE - 300,
        })
        setZoom(1)
      }
      // +/- 缩放
      if (e.key === '=' || e.key === '+') {
        setZoom(z => Math.min(MAX_ZOOM, z + 0.2))
      }
      if (e.key === '-') {
        setZoom(z => Math.max(MIN_ZOOM, z - 0.2))
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase())
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // 鼠标滚轮缩放
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)))
    }
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [])

  // 触摸事件处理
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          dist: 0,
        }
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        touchStartRef.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          dist: Math.sqrt(dx * dx + dy * dy),
        }
      }
    }
    
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1 && touchStartRef.current) {
        const dx = e.touches[0].clientX - touchStartRef.current.x
        const dy = e.touches[0].clientY - touchStartRef.current.y
        setCamera(c => ({ x: c.x - dx / zoom, y: c.y - dy / zoom }))
        touchStartRef.current.x = e.touches[0].clientX
        touchStartRef.current.y = e.touches[0].clientY
      } else if (e.touches.length === 2 && touchStartRef.current) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const newDist = Math.sqrt(dx * dx + dy * dy)
        const scale = newDist / touchStartRef.current.dist
        setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * scale)))
        touchStartRef.current.dist = newDist
      }
    }
    
    const handleTouchEnd = () => {
      touchStartRef.current = null
    }
    
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd)
    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
    }
  }, [zoom])

  // 生成新蚂蚁
  const spawnAnt = useCallback((game: GameState, type: 'worker' | 'soldier' | 'male' | 'female', x: number, y: number) => {
    const id = game.nextAntId++
    const angle = Math.random() * Math.PI * 2
    const isReproductive = type === 'male' || type === 'female'
    
    const newAnt: Ant = {
      id,
      x: x + Math.cos(angle) * 10,
      y: y + Math.sin(angle) * 10,
      targetX: NEST_CENTER_X * TILE_SIZE + Math.cos(angle) * 40,
      targetY: NEST_CENTER_Y * TILE_SIZE + Math.sin(angle) * 40,
      state: 'idle',
      type,
      energy: 60,
      age: 0,
      maxAge: type === 'worker' ? WORKER_MAX_AGE + Math.floor(Math.random() * 1200) : 
              type === 'soldier' ? SOLDIER_MAX_AGE + Math.floor(Math.random() * 1200) :
              3600, // 繁殖蚁寿命60秒
      direction: 1,
      frame: 0,
      carryingFood: false,
      speed: type === 'worker' ? 0.7 + Math.random() * 0.5 : 
             type === 'soldier' ? 0.5 + Math.random() * 0.3 :
             1.2 + Math.random() * 0.5, // 繁殖蚁速度更快
      hasWings: isReproductive,
      isMated: false,
    }
    game.ants.push(newAnt)
    game.totalAnts = game.ants.filter(a => a.state !== 'dead').length

    // 出生粒子效果
    for (let i = 0; i < 6; i++) {
      game.particles.push({
        x: newAnt.x,
        y: newAnt.y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        life: 25,
        maxLife: 25,
        color: isReproductive ? '#FF69B4' : '#FFD700',
      })
    }
  }, [])

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
      p.vy += 0.05
      p.life--
      return p.life > 0
    })

    // 天数计算（每1800帧=30秒为一天）
    if (tickRef.current % 1800 === 0) {
      game.day++
      // 每天消耗食物（只有活着的非蚁后蚂蚁消耗）
      const aliveNonQueen = game.ants.filter(a => a.state !== 'dead' && a.type !== 'queen')
      const consumption = Math.ceil(aliveNonQueen.length * 0.5)
      game.foodStored = Math.max(0, game.foodStored - consumption)
      
      // 蚁后饥饿度增加
      game.queenHunger = Math.min(100, game.queenHunger + 5)
      
      if (game.foodStored <= 0) {
        game.message = '⚠️ 食物不足！快放置食物喂养蚁群！'
        game.messageTimer = 200
      }
    }

    // 卵孵化成幼虫
    game.eggs = game.eggs.filter(egg => {
      egg.hatchTimer--
      if (egg.hatchTimer <= 0) {
        // 孵化成幼虫！
        const foodRequired = egg.type === 'worker' ? 5 : 8
        const newLarva: Larva = {
          id: game.nextLarvaId++,
          x: egg.x,
          y: egg.y,
          type: egg.type,
          foodReceived: 0,
          foodRequired: foodRequired,
          frame: 0,
        }
        game.larvas.push(newLarva)
        game.message = `🐛 卵孵化成了${egg.type === 'worker' ? '工蚁' : '兵蚁'}幼虫！`
        game.messageTimer = 120
        return false
      }
      return true
    })

    // 幼虫成长（需要工蚁或蚁后喂食）
    const larvasToRemove: number[] = []
    
    game.larvas.forEach(larva => {
      larva.frame++
      
      // 检查是否有工蚁或蚁后在附近喂食
      if (larva.foodReceived < larva.foodRequired) {
        const nearbyFeeders = game.ants.filter(ant => {
          if (ant.state === 'dead') return false
          // 工蚁或蚁后都可以喂食
          if (ant.type !== 'worker' && ant.type !== 'queen') return false
          const dist = Math.sqrt((ant.x - larva.x) ** 2 + (ant.y - larva.y) ** 2)
          return dist < 30 // 增加到30像素范围
        })
        
        // 如果有喂食者在附近，每60帧喂一次
        if (nearbyFeeders.length > 0 && tickRef.current % 60 === 0) {
          larva.foodReceived++
          // 喂食粒子
          game.particles.push({
            x: larva.x,
            y: larva.y,
            vx: 0,
            vy: -1,
            life: 20,
            maxLife: 20,
            color: '#90EE90',
          })
          
          if (tickRef.current % 180 === 0) {
            game.message = `🍼 幼虫进食中... (${larva.foodReceived}/${larva.foodRequired})`
            game.messageTimer = 60
          }
        }
      } else {
        // 幼虫吃饱了，变成茧
        const newCocoon: Cocoon = {
          id: game.nextCocoonId++,
          x: larva.x,
          y: larva.y,
          type: larva.type,
          hatchTimer: 600, // 10秒后孵化
        }
        game.cocoons.push(newCocoon)
        larvasToRemove.push(larva.id)
        game.message = `🟠 ${larva.type === 'worker' ? '工蚁' : '兵蚁'}幼虫结茧了！`
        game.messageTimer = 120
      }
    })
    
    // 移除已结茧的幼虫
    if (larvasToRemove.length > 0) {
      game.larvas = game.larvas.filter(l => !larvasToRemove.includes(l.id))
    }

    // 茧孵化成蚂蚁
    game.cocoons = game.cocoons.filter(cocoon => {
      cocoon.hatchTimer--
      if (cocoon.hatchTimer <= 0) {
        // 孵化成蚂蚁！
        spawnAnt(game, cocoon.type, cocoon.x, cocoon.y)
        game.message = `🎉 新${cocoon.type === 'worker' ? '工蚁' : '兵蚁'}孵化了！`
        game.messageTimer = 120
        return false
      }
      return true
    })

    // 更新蟋蟀
    game.crickets.forEach(cricket => {
      cricket.frame++
      
      // 蟋蟀随机移动
      if (cricket.jumpTimer <= 0) {
        // 选择新目标
        const angle = Math.random() * Math.PI * 2
        const dist = 30 + Math.random() * 60
        cricket.targetX = cricket.x + Math.cos(angle) * dist
        cricket.targetY = cricket.y + Math.sin(angle) * dist
        cricket.jumpTimer = 60 + Math.floor(Math.random() * 120) // 1-3秒后再次跳跃
      } else {
        cricket.jumpTimer--
      }
      
      // 向目标移动
      const dx = cricket.targetX - cricket.x
      const dy = cricket.targetY - cricket.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      
      if (dist > 5) {
        cricket.x += (dx / dist) * cricket.speed
        cricket.y += (dy / dist) * cricket.speed
        // 更新方向
        cricket.direction = dx > 0 ? 1 : 3
      }
    })

    // 蚁后产卵逻辑
    const queen = game.ants.find(a => a.type === 'queen' && a.state !== 'dead')
    if (queen) {
      queen.frame++
      queen.age++

      // 检查蚁后附近是否有食物（蚁后会自己吃）
      const eatRadius = 80 // 蚁后检测食物的范围（增加到80像素）
      let closestFood: Food | null = null
      let closestFoodDist = Infinity
      
      game.foods.forEach(food => {
        const foodX = food.x * TILE_SIZE
        const foodY = food.y * TILE_SIZE
        const dist = Math.sqrt((foodX - queen.x) ** 2 + (foodY - queen.y) ** 2)
        if (dist < eatRadius && dist < closestFoodDist) {
          closestFoodDist = dist
          closestFood = food
        }
      })
      
      // 如果附近有食物，蚁后会去吃
      if (closestFood) {
        const targetFood = closestFood as Food
        const foodX = targetFood.x * TILE_SIZE
        const foodY = targetFood.y * TILE_SIZE
        
        // 显示蚁后检测到食物的消息（只在第一次检测到时显示）
        if (closestFoodDist > 15 && tickRef.current % 120 === 0) {
          game.message = `👑 蚁后发现食物，正在移动过去...`
          game.messageTimer = 60
        }
        
        // 如果离食物很近，吃掉它（每60帧才能吃一次）
        if (closestFoodDist < 15 && tickRef.current % 60 === 0) {
          targetFood.amount--
          game.foodForQueen++
          
          // 吃掉食物的粒子效果
          game.particles.push({
            x: queen.x,
            y: queen.y,
            vx: 0,
            vy: -1,
            life: 20,
            maxLife: 20,
            color: '#90EE90',
          })
          
          // 如果食物吃完，移除
          if (targetFood.amount <= 0) {
            game.foods = game.foods.filter(f => f.id !== targetFood.id)
          }
          
          game.message = `👑 蚁后吃了食物！储备: ${game.foodForQueen}`
          game.messageTimer = 80
        }
        
        // 蚁后吃完食物后检查是否可以产卵（每300帧才能产一次）
        if (closestFoodDist < 15 && tickRef.current % 300 === 0 && game.foodForQueen >= 1) {
          const workerCountForLay = game.ants.filter(a => a.type === 'worker' && a.state !== 'dead').length
          const totalAntCount = game.ants.filter(a => a.state !== 'dead').length
          const canLaySoldierForQueen = workerCountForLay >= 18
          const canLayReproductive = totalAntCount >= 50 // 50只蚂蚁后可以产繁殖蚁
          
          // 优先产繁殖蚁（如果有50只蚂蚁且有3个食物）
          if (canLayReproductive && game.foodForQueen >= 3 && Math.random() < 0.2) {
            game.foodForQueen -= 3
            game.queenHunger = Math.max(0, game.queenHunger - 40)
            
            // 产繁殖蚁卵（雄蚁或雌蚁）
            const reproductiveType = Math.random() < 0.5 ? 'male' : 'female'
            const eggAngle = Math.random() * Math.PI * 2
            const eggDist = 15 + Math.random() * 10
            const newEgg: Egg = {
              id: Date.now() + Math.random(),
              x: queen.x + Math.cos(eggAngle) * eggDist,
              y: queen.y + Math.sin(eggAngle) * eggDist,
              hatchTimer: EGG_HATCH_TIME,
              type: reproductiveType,
            }
            game.eggs.push(newEgg)
            
            // 产卵粒子
            for (let i = 0; i < 8; i++) {
              game.particles.push({
                x: queen.x,
                y: queen.y,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                life: 30,
                maxLife: 30,
                color: '#FF69B4',
              })
            }
            
            game.message = `🥚 蚁后产下了一枚${reproductiveType === 'male' ? '雄蚁' : '雌蚁'}卵！(3食物→1卵)`
            game.messageTimer = 150
          }
          // 尝试产兵蚁（如果有足够工蚁且有2个食物）
          else if (canLaySoldierForQueen && game.foodForQueen >= 2 && Math.random() < 0.3) {
            game.foodForQueen -= 2
            game.queenHunger = Math.max(0, game.queenHunger - 30)
            
            // 产兵蚁卵
            const eggAngle = Math.random() * Math.PI * 2
            const eggDist = 15 + Math.random() * 10
            const newEgg: Egg = {
              id: Date.now() + Math.random(),
              x: queen.x + Math.cos(eggAngle) * eggDist,
              y: queen.y + Math.sin(eggAngle) * eggDist,
              hatchTimer: EGG_HATCH_TIME,
              type: 'soldier',
            }
            game.eggs.push(newEgg)
            
            // 产卵粒子
            for (let i = 0; i < 8; i++) {
              game.particles.push({
                x: queen.x,
                y: queen.y,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                life: 30,
                maxLife: 30,
                color: '#ff4444',
              })
            }
            
            game.message = `🥚 蚁后产下了一枚兵蚁卵！(2食物→1卵)`
            game.messageTimer = 150
          }
          // 产工蚁卵（需要1个食物）
          else if (game.foodForQueen >= 1) {
            game.foodForQueen -= 1
            game.queenHunger = Math.max(0, game.queenHunger - 20)
            
            // 产工蚁卵
            const eggAngle = Math.random() * Math.PI * 2
            const eggDist = 15 + Math.random() * 10
            const newEgg: Egg = {
              id: Date.now() + Math.random(),
              x: queen.x + Math.cos(eggAngle) * eggDist,
              y: queen.y + Math.sin(eggAngle) * eggDist,
              hatchTimer: EGG_HATCH_TIME,
              type: 'worker',
            }
            game.eggs.push(newEgg)
            
            // 产卵粒子
            for (let i = 0; i < 8; i++) {
              game.particles.push({
                x: queen.x,
                y: queen.y,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                life: 30,
                maxLife: 30,
                color: '#FFD700',
              })
            }
            
            game.message = `🥚 蚁后产下了一枚工蚁卵！(1食物→1卵)`
            game.messageTimer = 150
          }
        }
        
        // 如果食物不近，向食物移动
        if (closestFoodDist >= 15) {
          // 向食物移动
          queen.targetX = foodX
          queen.targetY = foodY
          
          // 实际移动代码
          const moveDx = foodX - queen.x
          const moveDy = foodY - queen.y
          const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy)
          
          if (moveDist > 1) {
            queen.x += (moveDx / moveDist) * queen.speed
            queen.y += (moveDy / moveDist) * queen.speed
            // 更新方向
            if (Math.abs(moveDx) > Math.abs(moveDy)) {
              queen.direction = moveDx > 0 ? 1 : 3
            } else {
              queen.direction = moveDy > 0 ? 2 : 0
            }
          }
        }
      } else {
        // 没有食物时，在巢穴区域内缓慢移动
        const queenDx = queen.targetX - queen.x
        const queenDy = queen.targetY - queen.y
        const queenDist = Math.sqrt(queenDx * queenDx + queenDy * queenDy)
        
        // 如果到达目标或离目标很近，选择新目标
        if (queenDist < 5 || Math.random() < 0.005) {
          // 在巢穴半径内随机选择新位置
          const angle = Math.random() * Math.PI * 2
          const radius = Math.random() * (NEST_RADIUS * TILE_SIZE * 0.6) // 只在巢穴60%范围内移动
          queen.targetX = NEST_CENTER_X * TILE_SIZE + Math.cos(angle) * radius
          queen.targetY = NEST_CENTER_Y * TILE_SIZE + Math.sin(angle) * radius
        }
        
        // 向目标移动（很慢）
        if (queenDist > 1) {
          queen.x += (queenDx / queenDist) * queen.speed
          queen.y += (queenDy / queenDist) * queen.speed
          // 更新方向
          if (Math.abs(queenDx) > Math.abs(queenDy)) {
            queen.direction = queenDx > 0 ? 1 : 3
          } else {
            queen.direction = queenDy > 0 ? 2 : 0
          }
        }
      }

      // 蚁后饥饿度自然增加
      if (tickRef.current % 300 === 0) {
        game.queenHunger = Math.min(100, game.queenHunger + 2)
      }
    }

    // 升级蚁巢
    const aliveCount = game.ants.filter(a => a.state !== 'dead').length
    if (aliveCount >= game.nestLevel * 8 + 5 && game.foodStored >= game.nestLevel * 15) {
      game.nestLevel++
      game.message = `🏰 蚁巢升级到 ${game.nestLevel} 级！`
      game.messageTimer = 200
    }

    // 繁殖蚁逻辑：孵化后飞向野外
    game.ants.forEach(ant => {
      if (ant.state === 'dead') return
      if (ant.type !== 'male' && ant.type !== 'female') return
      
      // 繁殖蚁孵化后3秒开始飞向野外
      if (ant.age > 180 && ant.state !== 'flying') {
        ant.state = 'flying'
        // 设置飞向野外的目标（远离巢穴）
        const flyAngle = Math.random() * Math.PI * 2
        const flyDist = 800 + Math.random() * 400
        ant.targetX = NEST_CENTER_X * TILE_SIZE + Math.cos(flyAngle) * flyDist
        ant.targetY = NEST_CENTER_Y * TILE_SIZE + Math.sin(flyAngle) * flyDist
        game.message = `🪽 ${ant.type === 'male' ? '雄蚁' : '雌蚁'}开始飞向野外！`
        game.messageTimer = 120
      }
      
      // 飞行中的繁殖蚁
      if (ant.state === 'flying') {
        const dx = ant.targetX - ant.x
        const dy = ant.targetY - ant.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        
        if (dist > 5) {
          ant.x += (dx / dist) * ant.speed * 2 // 飞行速度更快
          ant.y += (dy / dist) * ant.speed * 2
          // 更新方向
          if (Math.abs(dx) > Math.abs(dy)) {
            ant.direction = dx > 0 ? 1 : 3
          } else {
            ant.direction = dy > 0 ? 2 : 0
          }
        } else {
          // 到达野外，转移到wildAnts
          if (game.currentScene === 'nest') {
            game.wildAnts.push({...ant})
            ant.state = 'dead' // 从巢穴列表中移除
          }
        }
      }
    })
    
    // 野外繁殖蚁交配逻辑
    if (game.wildAnts.length > 0) {
      const wildMales = game.wildAnts.filter(a => a.type === 'male' && a.state === 'flying')
      const wildFemales = game.wildAnts.filter(a => a.type === 'female' && a.state === 'flying' && !a.isMated)
      
      // 每60帧检查一次交配
      if (tickRef.current % 60 === 0 && wildMales.length > 0 && wildFemales.length > 0) {
        const male = wildMales[Math.floor(Math.random() * wildMales.length)]
        const female = wildFemales[Math.floor(Math.random() * wildFemales.length)]
        
        // 检查距离
        const dist = Math.sqrt((male.x - female.x) ** 2 + (male.y - female.y) ** 2)
        if (dist < 50) {
          // 交配成功
          female.isMated = true
          female.state = 'idle'
          male.state = 'dead' // 雄蚁交配后死亡
          
          // 交配粒子
          for (let i = 0; i < 10; i++) {
            game.particles.push({
              x: female.x,
              y: female.y,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              life: 30,
              maxLife: 30,
              color: '#FF1493',
            })
          }
          
          game.message = `💕 野外交配成功！雌蚁成为新蚁后`
          game.messageTimer = 150
          
          // 交配后的雌蚁变成可捕捉的蚁后
          game.wildQueens.push({
            ...female,
            type: 'queen',
            hasWings: false,
            speed: 0.3,
          })
          
          // 从wildAnts中移除
          game.wildAnts = game.wildAnts.filter(a => a.id !== female.id)
        }
      }
    }
    
    // 野外随机刷新蚁后（每30秒有10%概率）
    if (tickRef.current % 1800 === 0 && Math.random() < 0.1) {
      const wildQueenX = NEST_CENTER_X * TILE_SIZE + (Math.random() - 0.5) * 1600
      const wildQueenY = NEST_CENTER_Y * TILE_SIZE + (Math.random() - 0.5) * 1200
      const newWildQueen: Ant = {
        id: game.nextAntId++,
        x: wildQueenX,
        y: wildQueenY,
        targetX: wildQueenX,
        targetY: wildQueenY,
        state: 'idle',
        type: 'queen',
        energy: 100,
        age: 0,
        maxAge: Infinity,
        direction: 1,
        frame: 0,
        carryingFood: false,
        speed: 0.3,
        hasWings: false,
        isMated: true,
      }
      game.wildQueens.push(newWildQueen)
      game.message = `👑 野外发现了一只新蚁后！`
      game.messageTimer = 150
    }

    // 更新蚂蚁AI
    game.ants.forEach((ant) => {
      if (ant.state === 'dead') return
      
      ant.frame++
      ant.age++

      // 寿命检查（蚁后不会死）
      if (ant.type !== 'queen' && ant.age >= ant.maxAge) {
        ant.state = 'dead'
        game.totalAnts = game.ants.filter(a => a.state !== 'dead').length
        // 死亡粒子
        for (let i = 0; i < 4; i++) {
          game.particles.push({
            x: ant.x,
            y: ant.y,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 2,
            life: 20,
            maxLife: 20,
            color: '#666',
          })
        }
        return
      }

      // 蚁后不移动
      if (ant.type === 'queen') return

      // 能量消耗
      if (tickRef.current % 180 === 0) {
        ant.energy = Math.max(0, ant.energy - 1)
        if (ant.energy <= 0) {
          ant.state = 'resting'
        }
      }

      // 休息恢复
      if (ant.state === 'resting') {
        // 在巢附近休息
        const distToNest = Math.sqrt(
          (ant.x - NEST_CENTER_X * TILE_SIZE) ** 2 + (ant.y - NEST_CENTER_Y * TILE_SIZE) ** 2
        )
        if (distToNest > 30) {
          ant.targetX = NEST_CENTER_X * TILE_SIZE + (Math.random() - 0.5) * 20
          ant.targetY = NEST_CENTER_Y * TILE_SIZE + (Math.random() - 0.5) * 20
        }
        ant.energy = Math.min(100, ant.energy + 0.8)
        if (ant.energy >= 60) ant.state = 'idle'
        return
      }

      // 移动逻辑
      const dx = ant.targetX - ant.x
      const dy = ant.targetY - ant.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > 3) {
        ant.x += (dx / dist) * ant.speed
        ant.y += (dy / dist) * ant.speed
        // 更新方向（横向蚂蚁的方向映射）
        if (Math.abs(dx) > Math.abs(dy)) {
          ant.direction = dx > 0 ? 1 : 3 // 右或左
        } else {
          ant.direction = dy > 0 ? 2 : 0 // 下或上
        }
      } else {
        // 到达目标后选择新行为
        if (ant.state === 'carrying') {
          // 搬运食物回巢给蚁后
          ant.targetX = NEST_CENTER_X * TILE_SIZE + (Math.random() - 0.5) * 15
          ant.targetY = NEST_CENTER_Y * TILE_SIZE + (Math.random() - 0.5) * 15
          if (dist < 25) {
            // 到达巢穴，把食物给蚁后
            game.foodStored += 1
            game.foodForQueen += 1
            ant.carryingFood = false
            ant.state = 'idle'
            
            // 存储食物粒子
            for (let i = 0; i < 4; i++) {
              game.particles.push({
                x: ant.x,
                y: ant.y,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 2,
                life: 20,
                maxLife: 20,
                color: '#90EE90',
              })
            }
            
            // 工蚁只负责搬运食物，产卵由蚁后自己吃食物时触发
            game.message = `🍖 工蚁搬运了食物回巢！储备: ${game.foodForQueen}`
            game.messageTimer = 60
          }
        } else {
          // 工蚁寻找食物
          if (game.foods.length > 0 && ant.type === 'worker' && !ant.carryingFood) {
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
          } else if (ant.type === 'worker' && ant.carryingFood) {
            // 已经在搬运，目标是巢穴
            ant.state = 'carrying'
            ant.targetX = NEST_CENTER_X * TILE_SIZE
            ant.targetY = NEST_CENTER_Y * TILE_SIZE
          } else {
            // 兵蚁优先寻找蟋蟀攻击
            if (ant.type === 'soldier' && game.crickets.length > 0) {
              let closestCricket: Cricket | null = null
              let closestDist = Infinity
              game.crickets.forEach(cricket => {
                const cd = Math.sqrt((cricket.x - ant.x) ** 2 + (cricket.y - ant.y) ** 2)
                if (cd < closestDist) {
                  closestDist = cd
                  closestCricket = cricket
                }
              })
              
              if (closestCricket) {
                const target = closestCricket as Cricket
                ant.targetX = target.x
                ant.targetY = target.y
                
                // 到达蟋蟀附近，开始攻击
                if (closestDist < 15) {
                  // 攻击蟋蟀
                  if (tickRef.current % 30 === 0) {
                    target.hp -= 5
                    // 攻击粒子
                    for (let i = 0; i < 3; i++) {
                      game.particles.push({
                        x: target.x + (Math.random() - 0.5) * 10,
                        y: target.y + (Math.random() - 0.5) * 10,
                        vx: (Math.random() - 0.5) * 3,
                        vy: -Math.random() * 2,
                        life: 15,
                        maxLife: 15,
                        color: '#ff4444',
                      })
                    }
                    
                    // 蟋蟀死亡
                    if (target.hp <= 0) {
                      game.crickets = game.crickets.filter(c => c.id !== target.id)
                      // 掉落食物
                      const foodDrop = 8 + Math.floor(Math.random() * 5)
                      game.foods.push({
                        id: Date.now() + Math.random(),
                        x: Math.floor(target.x / TILE_SIZE),
                        y: Math.floor(target.y / TILE_SIZE),
                        amount: foodDrop,
                        type: 'insect',
                      })
                      // 死亡粒子
                      for (let i = 0; i < 10; i++) {
                        game.particles.push({
                          x: target.x,
                          y: target.y,
                          vx: (Math.random() - 0.5) * 4,
                          vy: (Math.random() - 0.5) * 4,
                          life: 30,
                          maxLife: 30,
                          color: '#4a6b3a',
                        })
                      }
                      game.message = `⚔️ 兵蚁击杀了蟋蟀！掉落 ${foodDrop} 食物`
                      game.messageTimer = 150
                    }
                  }
                }
              }
            } else {
              // 工蚁：优先去喂食幼虫
              if (ant.type === 'worker' && game.larvas.length > 0) {
                // 找需要喂食的幼虫
                const hungryLarvas = game.larvas.filter(l => l.foodReceived < l.foodRequired)
                if (hungryLarvas.length > 0) {
                  // 找最近的幼虫
                  let closestLarva = hungryLarvas[0]
                  let closestLarvaDist = Infinity
                  hungryLarvas.forEach(larva => {
                    const dist = Math.sqrt((larva.x - ant.x) ** 2 + (larva.y - ant.y) ** 2)
                    if (dist < closestLarvaDist) {
                      closestLarvaDist = dist
                      closestLarva = larva
                    }
                  })
                  
                  // 向幼虫移动
                  ant.targetX = closestLarva.x
                  ant.targetY = closestLarva.y
                } else {
                  // 所有幼虫都吃饱了，随机巡逻
                  if (Math.random() < 0.02) {
                    const patrolRadius = NEST_RADIUS + 35
                    const angle = Math.random() * Math.PI * 2
                    const r = Math.random() * patrolRadius
                    ant.targetX = NEST_CENTER_X * TILE_SIZE + Math.cos(angle) * r * TILE_SIZE
                    ant.targetY = NEST_CENTER_Y * TILE_SIZE + Math.sin(angle) * r * TILE_SIZE
                  }
                }
              } else {
                // 兵蚁或没有幼虫：随机巡逻
                if (Math.random() < 0.02) {
                  const patrolRadius = ant.type === 'soldier' ? NEST_RADIUS + 15 : NEST_RADIUS + 35
                  const angle = Math.random() * Math.PI * 2
                  const r = Math.random() * patrolRadius
                  ant.targetX = NEST_CENTER_X * TILE_SIZE + Math.cos(angle) * r * TILE_SIZE
                  ant.targetY = NEST_CENTER_Y * TILE_SIZE + Math.sin(angle) * r * TILE_SIZE
                }
              }
            }
          }
        }
      }
    })

    // 清理死亡蚂蚁（超过一定时间后移除）
    game.ants = game.ants.filter(a => a.state !== 'dead' || a.age < a.maxAge + 120)

    // 每30帧刷新一次React状态
    if (tickRef.current % 30 === 0) {
      forceUpdate((v) => v + 1)
    }
  }, [spawnAnt])

  // 渲染游戏
  const renderGame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const game = gameRef.current
    const cam = camera
    const z = zoom

    ctx.imageSmoothingEnabled = false

    // 根据场景绘制不同背景
    if (game.currentScene === 'wild') {
      // 野外场景 - 绿色草地背景
      ctx.fillStyle = '#2d5016'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    } else {
      // 巢穴场景 - 土壤背景
      ctx.fillStyle = '#2d1b0e'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    // 应用缩放
    ctx.save()
    ctx.scale(z, z)
    
    // 计算缩放后的可视区域
    const viewW = canvas.width / z
    const viewH = canvas.height / z

    // 绘制背景纹理
    if (game.currentScene === 'wild') {
      // 野外草地纹理
      for (let x = 0; x < viewW; x += 12) {
        for (let y = 0; y < viewH; y += 12) {
          const worldX = x + cam.x
          const worldY = y + cam.y
          const noise = Math.sin(worldX * 0.03) * Math.cos(worldY * 0.03)
          if (noise > 0.2) {
            ctx.fillStyle = '#3d6020'
            ctx.fillRect(x, y, 6, 6)
          } else if (noise < -0.2) {
            ctx.fillStyle = '#1d4010'
            ctx.fillRect(x, y, 6, 6)
          }
        }
      }
    } else {
      // 巢穴土壤纹理
      for (let x = 0; x < viewW; x += 8) {
        for (let y = 0; y < viewH; y += 8) {
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
    ctx.arc(nestScreenX, nestScreenY, 25 + game.nestLevel * 2, 0, Math.PI * 2)
    ctx.fillStyle = '#6b4423'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(nestScreenX, nestScreenY, 15 + game.nestLevel, 0, Math.PI * 2)
    ctx.fillStyle = '#8B6914'
    ctx.fill()

    // 蚁后饥饿度指示（围绕蚁后的环）
    const hungerAngle = (game.queenHunger / 100) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(nestScreenX, nestScreenY, 20 + game.nestLevel, -Math.PI / 2, -Math.PI / 2 + hungerAngle)
    ctx.strokeStyle = game.queenHunger > 70 ? '#ff4444' : game.queenHunger > 40 ? '#ffaa00' : '#44ff44'
    ctx.lineWidth = 3
    ctx.stroke()

    // 食物储备给蚁后的指示
    const foodBars = Math.min(10, game.foodForQueen)
    for (let i = 0; i < foodBars; i++) {
      const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2
      const r = 28 + game.nestLevel * 2
      const sx = nestScreenX + Math.cos(angle) * r
      const sy = nestScreenY + Math.sin(angle) * r
      drawPixelRect(ctx, sx - 2, sy - 2, 4, 4, '#90EE90')
    }

    // 绘制卵
    game.eggs.forEach((egg) => {
      const ex = egg.x - cam.x
      const ey = egg.y - cam.y
      if (ex > -20 && ex < viewW + 20 && ey > -20 && ey < viewH + 20) {
        drawEgg(ctx, ex, ey, egg.hatchTimer)
      }
    })

    // 绘制幼虫
    game.larvas.forEach((larva) => {
      const lx = larva.x - cam.x
      const ly = larva.y - cam.y
      if (lx > -30 && lx < viewW + 30 && ly > -30 && ly < viewH + 30) {
        drawLarva(ctx, lx, ly, larva.frame, larva.type, larva.foodReceived, larva.foodRequired)
      }
    })

    // 绘制茧
    game.cocoons.forEach((cocoon) => {
      const cx = cocoon.x - cam.x
      const cy = cocoon.y - cam.y
      if (cx > -30 && cx < viewW + 30 && cy > -30 && cy < viewH + 30) {
        drawCocoon(ctx, cx, cy, cocoon.type, cocoon.hatchTimer)
      }
    })

    // 绘制食物
    game.foods.forEach((food) => {
      const fx = food.x * TILE_SIZE - cam.x
      const fy = food.y * TILE_SIZE - cam.y
      if (fx > -50 && fx < viewW + 50 && fy > -50 && fy < viewH + 50) {
        drawPixelFood(ctx, fx, fy, food.type)
        // 食物量指示
        const barW = food.amount * 2
        drawPixelRect(ctx, fx - 8, fy + 10, barW, 3, '#4CAF50')
        drawPixelRect(ctx, fx - 8, fy + 10, 20, 3, 'rgba(255,255,255,0.2)')
      }
    })

    // 绘制蟋蟀
    game.crickets.forEach((cricket) => {
      const cx = cricket.x - cam.x
      const cy = cricket.y - cam.y
      if (cx > -50 && cx < viewW + 50 && cy > -50 && cy < viewH + 50) {
        drawCricket(ctx, cx, cy, cricket.direction, cricket.frame, cricket.hp, cricket.maxHp)
      }
    })

    // 绘制蚂蚁（活的）
    game.ants.forEach((ant) => {
      if (ant.state === 'dead') return
      const ax = ant.x - cam.x
      const ay = ant.y - cam.y
      if (ax > -40 && ax < viewW + 40 && ay > -40 && ay < viewH + 40) {
        drawPixelAnt(ctx, ax, ay, ant.direction, ant.frame, ant.type, ant.carryingFood, ant.hasWings)
        
        // 寿命指示条（仅非蚁后）
        if (ant.type !== 'queen') {
          const lifePercent = 1 - ant.age / ant.maxAge
          const barWidth = 12
          const barX = ax - barWidth / 2
          const barY = ay - (ant.type === 'soldier' ? 16 : 12)
          // 背景
          drawPixelRect(ctx, barX, barY, barWidth, 2, '#333')
          // 寿命条
          const lifeColor = lifePercent > 0.5 ? '#44ff44' : lifePercent > 0.2 ? '#ffaa00' : '#ff4444'
          drawPixelRect(ctx, barX, barY, Math.floor(barWidth * lifePercent), 2, lifeColor)
        }
      }
    })

    // 绘制野外蚂蚁和蚁后（只在野外场景显示）
    if (game.currentScene === 'wild') {
      // 绘制野外繁殖蚁
      game.wildAnts.forEach((ant) => {
        if (ant.state === 'dead') return
        const ax = ant.x - cam.x
        const ay = ant.y - cam.y
        if (ax > -40 && ax < viewW + 40 && ay > -40 && ay < viewH + 40) {
          drawPixelAnt(ctx, ax, ay, ant.direction, ant.frame, ant.type, false, ant.hasWings)
        }
      })
      
      // 绘制野外蚁后
      game.wildQueens.forEach((ant) => {
        const ax = ant.x - cam.x
        const ay = ant.y - cam.y
        if (ax > -40 && ax < viewW + 40 && ay > -40 && ay < viewH + 40) {
          drawPixelAnt(ctx, ax, ay, ant.direction, ant.frame, ant.type, false, false)
          
          // 可捕捉标记
          ctx.fillStyle = '#FFD700'
          ctx.font = '16px Arial'
          ctx.fillText('👑', ax - 8, ay - 20)
        }
      })
    }

    // 绘制粒子
    game.particles.forEach((p) => {
      const px = p.x - cam.x
      const py = p.y - cam.y
      ctx.globalAlpha = p.life / p.maxLife
      drawPixelRect(ctx, px, py, 3, 3, p.color)
    })
    ctx.globalAlpha = 1

    // 绘制网格参考线
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 1
    for (let x = -cam.x % 40; x < viewW; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, viewH)
      ctx.stroke()
    }
    for (let y = -cam.y % 40; y < viewH; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(viewW, y)
      ctx.stroke()
    }

    // 恢复缩放
    ctx.restore()

    // 绘制小地图（不受缩放影响）
    if (showMinimap) {
      const mapSize = 150
      const mapX = canvas.width - mapSize - 10
      const mapY = canvas.height - mapSize - 10
      const mapScale = 0.15 // 小地图缩放比例
      
      // 小地图背景
      ctx.fillStyle = 'rgba(26, 15, 10, 0.9)'
      ctx.fillRect(mapX - 2, mapY - 2, mapSize + 4, mapSize + 4)
      ctx.strokeStyle = '#daa520'
      ctx.lineWidth = 2
      ctx.strokeRect(mapX - 2, mapY - 2, mapSize + 4, mapSize + 4)
      
      // 小地图内容
      ctx.fillStyle = '#2d1b0e'
      ctx.fillRect(mapX, mapY, mapSize, mapSize)
      
      // 蚁巢在小地图上的位置
      const nestMapX = mapX + NEST_CENTER_X * TILE_SIZE * mapScale
      const nestMapY = mapY + NEST_CENTER_Y * TILE_SIZE * mapScale
      ctx.beginPath()
      ctx.arc(nestMapX, nestMapY, 8, 0, Math.PI * 2)
      ctx.fillStyle = '#8B6914'
      ctx.fill()
      
      // 蚂蚁在小地图上的位置
      game.ants.forEach(ant => {
        if (ant.state === 'dead') return
        const antMapX = mapX + ant.x * mapScale
        const antMapY = mapY + ant.y * mapScale
        if (antMapX >= mapX && antMapX <= mapX + mapSize && antMapY >= mapY && antMapY <= mapY + mapSize) {
          ctx.fillStyle = ant.type === 'queen' ? '#FFD700' : ant.type === 'soldier' ? '#ff4444' : '#8B6914'
          ctx.fillRect(antMapX - 1, antMapY - 1, 2, 2)
        }
      })
      
      // 食物在小地图上的位置
      game.foods.forEach(food => {
        const foodMapX = mapX + food.x * TILE_SIZE * mapScale
        const foodMapY = mapY + food.y * TILE_SIZE * mapScale
        if (foodMapX >= mapX && foodMapX <= mapX + mapSize && foodMapY >= mapY && foodMapY <= mapY + mapSize) {
          ctx.fillStyle = '#90EE90'
          ctx.fillRect(foodMapX - 1, foodMapY - 1, 2, 2)
        }
      })
      
      // 当前视角框
      const viewFrameX = mapX + cam.x * mapScale
      const viewFrameY = mapY + cam.y * mapScale
      const viewFrameW = viewW * mapScale
      const viewFrameH = viewH * mapScale
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      ctx.strokeRect(viewFrameX, viewFrameY, viewFrameW, viewFrameH)
    }
  }, [camera, zoom, showMinimap])

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

  // 键盘和边缘滚动控制
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosition.current = { x: e.clientX, y: e.clientY }
    }
    
    // 鼠标离开窗口时重置位置
    const handleMouseLeave = () => {
      mousePosition.current = { x: -1000, y: -1000 }
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    
    const scrollInterval = setInterval(() => {
      const keys = keysPressed.current
      let dx = 0
      let dy = 0
      
      // 键盘控制
      if (keys.has('w') || keys.has('arrowup')) dy -= CAMERA_SPEED
      if (keys.has('s') || keys.has('arrowdown')) dy += CAMERA_SPEED
      if (keys.has('a') || keys.has('arrowleft')) dx -= CAMERA_SPEED
      if (keys.has('d') || keys.has('arrowright')) dx += CAMERA_SPEED
      
      // 边缘滚动（只在鼠标真正在画布内时触发）
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const mx = mousePosition.current.x
        const my = mousePosition.current.y
        
        // 严格检查鼠标是否在画布内
        const isInCanvas = mx >= rect.left && mx <= rect.right && my >= rect.top && my <= rect.bottom
        
        if (isInCanvas) {
          const distToLeft = mx - rect.left
          const distToRight = rect.right - mx
          const distToTop = my - rect.top
          const distToBottom = rect.bottom - my
          
          // 只有当鼠标在边缘阈值内时才触发滚动
          if (distToLeft < EDGE_SCROLL_THRESHOLD && distToLeft >= 0) {
            dx -= CAMERA_SPEED * (1 - distToLeft / EDGE_SCROLL_THRESHOLD)
          }
          if (distToRight < EDGE_SCROLL_THRESHOLD && distToRight >= 0) {
            dx += CAMERA_SPEED * (1 - distToRight / EDGE_SCROLL_THRESHOLD)
          }
          if (distToTop < EDGE_SCROLL_THRESHOLD && distToTop >= 0) {
            dy -= CAMERA_SPEED * (1 - distToTop / EDGE_SCROLL_THRESHOLD)
          }
          if (distToBottom < EDGE_SCROLL_THRESHOLD && distToBottom >= 0) {
            dy += CAMERA_SPEED * (1 - distToBottom / EDGE_SCROLL_THRESHOLD)
          }
        }
      }
      
      if (dx !== 0 || dy !== 0) {
        setCamera(c => ({ x: c.x + dx / zoom, y: c.y + dy / zoom }))
      }
    }, 16) // 约60fps
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      clearInterval(scrollInterval)
    }
  }, [zoom])

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
    // 考虑缩放
    const clickX = ((e.clientX - rect.left) * scaleX) / zoom + camera.x
    const clickY = ((e.clientY - rect.top) * scaleY) / zoom + camera.y
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
      game.message = '🌱 放置了种子！工蚁会来搬运给蚁后'
      game.messageTimer = 100
    } else if (game.selectedTool === 'food_sugar') {
      game.foods.push({
        id: Date.now() + 1,
        x: worldX,
        y: worldY,
        amount: 12,
        type: 'sugar',
      })
      game.message = '🍬 放置了糖分！蚁后最爱甜食'
      game.messageTimer = 100
    } else if (game.selectedTool === 'food_insect') {
      game.foods.push({
        id: Date.now() + 2,
        x: worldX,
        y: worldY,
        amount: 15,
        type: 'insect',
      })
      game.message = '🦗 放置了昆虫！高蛋白促进产卵'
      game.messageTimer = 100
    } else if (game.selectedTool === 'cricket') {
      const newCricket: Cricket = {
        id: game.nextCricketId++,
        x: clickX,
        y: clickY,
        targetX: clickX,
        targetY: clickY,
        hp: 50,
        maxHp: 50,
        direction: 1,
        frame: 0,
        speed: 1.5 + Math.random() * 0.5,
        jumpTimer: 0,
      }
      game.crickets.push(newCricket)
      game.message = '🦟 放置了蟋蟀！兵蚁会去攻击它'
      game.messageTimer = 100
    } else if (game.selectedTool === 'water') {
      game.ants.forEach((ant) => {
        if (ant.state === 'dead') return
        const dist = Math.sqrt((ant.x - clickX) ** 2 + (ant.y - clickY) ** 2)
        if (dist < 60) {
          ant.energy = Math.min(100, ant.energy + 30)
          game.particles.push({
            x: ant.x,
            y: ant.y,
            vx: 0,
            vy: -1,
            life: 20,
            maxLife: 20,
            color: '#87CEEB',
          })
        }
      })
      game.message = '💧 浇水成功！附近蚂蚁恢复了体力'
      game.messageTimer = 100
    } else if (game.selectedTool === 'catch') {
      // 捕捉野外蚁后
      if (game.currentScene !== 'wild') {
        game.message = '⚠️ 只能在野外场景捕捉蚁后！'
        game.messageTimer = 100
      } else {
        let caught = false
        game.wildQueens = game.wildQueens.filter(queen => {
          const dist = Math.sqrt((queen.x - clickX) ** 2 + (queen.y - clickY) ** 2)
          if (dist < 30 && !caught) {
            // 捕捉成功
            caught = true
            // 将蚁后带回巢穴
            game.ants.push({
              ...queen,
              x: NEST_CENTER_X * TILE_SIZE,
              y: NEST_CENTER_Y * TILE_SIZE,
              targetX: NEST_CENTER_X * TILE_SIZE,
              targetY: NEST_CENTER_Y * TILE_SIZE,
            })
            // 捕捉粒子
            for (let i = 0; i < 12; i++) {
              game.particles.push({
                x: queen.x,
                y: queen.y,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                life: 30,
                maxLife: 30,
                color: '#FFD700',
              })
            }
            game.message = '🎉 成功捕捉了一只蚁后！'
            game.messageTimer = 150
            return false // 从wildQueens中移除
          }
          return true
        })
        
        if (!caught) {
          game.message = '❌ 没有捕捉到蚁后，再试试！'
          game.messageTimer = 100
        }
      }
    }

    forceUpdate((v) => v + 1)
  }

  // 拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2 || e.button === 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX / zoom - camera.x, y: e.clientY / zoom - camera.y })
    }
  }

  const handleMouseMoveDrag = (e: React.MouseEvent) => {
    if (isDragging) {
      setCamera({
        x: e.clientX / zoom - dragStart.x,
        y: e.clientY / zoom - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }
  
  // 全局鼠标释放，防止拖拽卡住
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false)
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  const game = gameRef.current
  const aliveAnts = game.ants.filter(a => a.state !== 'dead')
  const workerCount = aliveAnts.filter(a => a.type === 'worker').length
  const soldierCount = aliveAnts.filter(a => a.type === 'soldier').length

  return (
    <div className="w-full h-screen bg-[#1a0f0a] flex flex-col overflow-hidden select-none"
      style={{ fontFamily: '"Courier New", monospace', imageRendering: 'pixelated' }}>
      
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d1b0e] border-b-2 border-[#4a3520]">
        <div className="flex items-center gap-4">
          <span className="text-[#daa520] text-lg font-bold tracking-wider">🐜 蚂蚁饲养员</span>
          <span className="text-[#8B6914] text-sm">第 {game.day} 天</span>
        </div>
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <span className="text-[#90EE90]">🍖 食物: {game.foodStored}</span>
          <span className="text-[#FFB6C1]">🐜 存活: {aliveAnts.length}</span>
          <span className="text-[#FFD700]">🥚 卵: {game.eggs.length}</span>
          <span className="text-[#FFE4B5]">🐛 幼虫: {game.larvas.length}</span>
          <span className="text-[#FF8C00]">🟠 茧: {game.cocoons.length}</span>
          <span className="text-[#4a6b3a]">🦟 蟋蟀: {game.crickets.length}</span>
          <span className="text-[#87CEEB]">🏰 Lv.{game.nestLevel}</span>
          <span className={game.queenHunger > 70 ? 'text-red-400' : game.queenHunger > 40 ? 'text-yellow-400' : 'text-green-400'}>
            👑 蚁后饥饿: {Math.floor(game.queenHunger)}%
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              game.currentScene = game.currentScene === 'nest' ? 'wild' : 'nest'
              setCamera({
                x: NEST_CENTER_X * TILE_SIZE - 400,
                y: NEST_CENTER_Y * TILE_SIZE - 300,
              })
              setZoom(1)
              forceUpdate(v => v + 1)
            }}
            className="px-3 py-1 bg-[#4a3520] text-[#daa520] border border-[#6b4423] hover:bg-[#5c4033] text-sm"
          >
            {game.currentScene === 'nest' ? '🌿 野外' : '🏠 巢穴'}
          </button>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="px-3 py-1 bg-[#4a3520] text-[#daa520] border border-[#6b4423] hover:bg-[#5c4033] text-sm"
          >
            ? 帮助
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧工具栏 */}
        <div className="w-52 bg-[#2d1b0e] border-r-2 border-[#4a3520] p-3 flex flex-col gap-2 overflow-y-auto">
          <div className="text-[#daa520] text-sm font-bold mb-2 border-b border-[#4a3520] pb-1">
            🔧 工具栏
          </div>
          
          {[
            { tool: 'food_seed' as const, icon: '🌱', name: '种子', desc: '食物量+8' },
            { tool: 'food_sugar' as const, icon: '🍬', name: '糖分', desc: '食物量+12' },
            { tool: 'food_insect' as const, icon: '🦗', name: '昆虫', desc: '食物量+15' },
            { tool: 'cricket' as const, icon: '🦟', name: '蟋蟀', desc: '兵蚁会攻击' },
            { tool: 'water' as const, icon: '💧', name: '浇水', desc: '恢复体力' },
            { tool: 'catch' as const, icon: '🪤', name: '捕捉', desc: '捕捉野外蚁后' },
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

          <div className="mt-3 border-t border-[#4a3520] pt-3">
            <div className="text-[#daa520] text-xs font-bold mb-2">📊 蚁群状态</div>
            <div className="text-[#a08060] text-xs space-y-1">
              <div>🟤 工蚁: {workerCount}</div>
              <div>🔴 兵蚁: {soldierCount}</div>
              <div>👑 蚁后: {aliveAnts.filter(a => a.type === 'queen').length}</div>
              <div>🥚 卵: {game.eggs.length}</div>
              <div>🐛 幼虫: {game.larvas.length}</div>
              <div>🟠 茧: {game.cocoons.length}</div>
              <div>🦟 蟋蟀: {game.crickets.length}</div>
              <div>🍖 搬运中: {aliveAnts.filter(a => a.state === 'carrying').length}</div>
              <div>🔍 觅食中: {aliveAnts.filter(a => a.state === 'seeking').length}</div>
            </div>
          </div>

          <div className="mt-3 border-t border-[#4a3520] pt-3">
            <div className="text-[#daa520] text-xs font-bold mb-2">👑 蚁后信息</div>
            <div className="text-[#a08060] text-xs space-y-1">
              <div>状态: {game.queenHunger > 70 ? '⚠️ 饥饿' : game.queenHunger > 40 ? '😐 一般' : '😊 满足'}</div>
              <div>食物储备: {game.foodForQueen}</div>
              <div>工蚁卵: 1食物 | 兵蚁卵: 2食物</div>
              <div>兵蚁解锁: {workerCount}/18工蚁</div>
              <div>寿命: ∞ (永生)</div>
            </div>
            {/* 蚁后饥饿条 */}
            <div className="mt-2 h-3 bg-[#1a0f0a] border border-[#4a3520]">
              <div
                className={`h-full transition-all ${
                  game.queenHunger > 70 ? 'bg-red-500' : game.queenHunger > 40 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${game.queenHunger}%` }}
              />
            </div>
          </div>

          <div className="mt-auto pt-3">
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
            onMouseMove={handleMouseMoveDrag}
            onMouseUp={handleMouseUp}
            onContextMenu={(e) => e.preventDefault()}
          />

          {/* 视角控制按钮 */}
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            {/* 缩放控制 */}
            <div className="flex flex-col gap-1 bg-[#2d1b0e]/80 border border-[#4a3520] rounded p-1">
              <button
                onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 0.2))}
                className="w-8 h-8 bg-[#3d2517] hover:bg-[#5c4033] text-[#daa520] border border-[#4a3520] text-lg font-bold flex items-center justify-center"
                title="放大 (+)"
              >
                +
              </button>
              <div className="text-center text-[#daa520] text-xs py-1">
                {Math.round(zoom * 100)}%
              </div>
              <button
                onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 0.2))}
                className="w-8 h-8 bg-[#3d2517] hover:bg-[#5c4033] text-[#daa520] border border-[#4a3520] text-lg font-bold flex items-center justify-center"
                title="缩小 (-)"
              >
                −
              </button>
            </div>
            
            {/* 回到中心 */}
            <button
              onClick={() => {
                setCamera({
                  x: NEST_CENTER_X * TILE_SIZE - 400,
                  y: NEST_CENTER_Y * TILE_SIZE - 300,
                })
                setZoom(1)
              }}
              className="w-10 h-10 bg-[#3d2517] hover:bg-[#5c4033] text-[#daa520] border border-[#4a3520] flex items-center justify-center text-lg"
              title="回到蚁巢 (空格)"
            >
              🏠
            </button>
            
            {/* 小地图开关 */}
            <button
              onClick={() => setShowMinimap(m => !m)}
              className={`w-10 h-10 border flex items-center justify-center text-lg ${
                showMinimap 
                  ? 'bg-[#5c4033] border-[#daa520] text-[#daa520]' 
                  : 'bg-[#3d2517] border-[#4a3520] text-[#a08060]'
              }`}
              title="小地图"
            >
              🗺️
            </button>
          </div>

          {/* 方向控制（移动端友好） */}
          <div className="absolute bottom-3 left-3 grid grid-cols-3 gap-1 md:hidden">
            <div></div>
            <button
              onTouchStart={() => keysPressed.current.add('arrowup')}
              onTouchEnd={() => keysPressed.current.delete('arrowup')}
              className="w-10 h-10 bg-[#3d2517]/80 border border-[#4a3520] text-[#daa520] flex items-center justify-center text-lg active:bg-[#5c4033]"
            >
              ↑
            </button>
            <div></div>
            <button
              onTouchStart={() => keysPressed.current.add('arrowleft')}
              onTouchEnd={() => keysPressed.current.delete('arrowleft')}
              className="w-10 h-10 bg-[#3d2517]/80 border border-[#4a3520] text-[#daa520] flex items-center justify-center text-lg active:bg-[#5c4033]"
            >
              ←
            </button>
            <button
              onTouchStart={() => keysPressed.current.add('arrowdown')}
              onTouchEnd={() => keysPressed.current.delete('arrowdown')}
              className="w-10 h-10 bg-[#3d2517]/80 border border-[#4a3520] text-[#daa520] flex items-center justify-center text-lg active:bg-[#5c4033]"
            >
              ↓
            </button>
            <button
              onTouchStart={() => keysPressed.current.add('arrowright')}
              onTouchEnd={() => keysPressed.current.delete('arrowright')}
              className="w-10 h-10 bg-[#3d2517]/80 border border-[#4a3520] text-[#daa520] flex items-center justify-center text-lg active:bg-[#5c4033]"
            >
              →
            </button>
          </div>

          {/* 操作提示 */}
          <div className="absolute bottom-3 right-3 text-[#6b4423] text-xs hidden md:block">
            <div>WASD/方向键 移动 | 滚轮 缩放</div>
            <div>空格 回到中心 | 右键拖拽</div>
          </div>

          {/* 消息提示 */}
          {game.messageTimer > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-[#2d1b0e]/90 border-2 border-[#daa520] text-[#daa520] text-sm font-bold animate-pulse whitespace-nowrap">
              {game.message}
            </div>
          )}

          {/* 帮助面板 */}
          {showHelp && (
            <div className="absolute inset-4 bg-[#2d1b0e]/95 border-2 border-[#daa520] p-6 overflow-auto">
              <div className="text-[#daa520] text-xl font-bold mb-4">📖 游戏指南</div>
              <div className="text-[#a08060] text-sm space-y-3">
                <p>🐜 <strong className="text-[#daa520]">目标：</strong>饲养你的蚂蚁群落，让它们繁荣壮大！</p>
                <hr className="border-[#4a3520]" />
                <p>🌱 <strong className="text-[#daa520]">喂食流程：</strong></p>
                <p>1. 点击地图放置食物（种子/糖分/昆虫）</p>
                <p>2. 工蚁自动找到食物并搬运回巢</p>
                <p>3. 食物交给蚁后，<strong className="text-[#FFD700]">工蚁卵需1食物，兵蚁卵需2食物</strong></p>
                <p>4. 卵孵化成<strong className="text-[#FFE4B5]">幼虫</strong>（工蚁需5食物，兵蚁需8食物）</p>
                <p>5. 幼虫吃饱后结<strong className="text-[#FF8C00]">茧</strong>（橙色大椭圆）</p>
                <p>6. 茧孵化后变成新蚂蚁</p>
                <hr className="border-[#4a3520]" />
                <p>🎯 <strong className="text-[#daa520]">前期限制：</strong></p>
                <p>• 开始只有蚁后，需要玩家放置食物启动</p>
                <p>• 需要 <strong className="text-[#FFD700]">18只工蚁</strong> 才能产出兵蚁卵</p>
                <p>• 工蚁卵概率 <strong>大于</strong> 兵蚁卵概率</p>
                <hr className="border-[#4a3520]" />
                <p>👑 <strong className="text-[#daa520]">蚁后：</strong></p>
                <p>• 在巢穴区域内<strong>缓慢移动</strong></p>
                <p>• 接受工蚁送来的食物后产卵</p>
                <p>• 寿命 <strong className="text-[#FFD700]">无限</strong>（永生）</p>
                <p>• 注意饥饿度！太高会影响产卵</p>
                <hr className="border-[#4a3520]" />
                <p>⚔️ <strong className="text-[#daa520]">战斗系统：</strong></p>
                <p>• 放置 <strong className="text-[#FFD700]">蟋蟀</strong> 让兵蚁攻击</p>
                <p>• 兵蚁会自动寻找并攻击蟋蟀</p>
                <p>• 蟋蟀被击杀后 <strong className="text-[#90EE90]">掉落食物</strong></p>
                <p>• 蟋蟀会随机跳跃移动</p>
                <hr className="border-[#4a3520]" />
                <p>🪽 <strong className="text-[#daa520]">繁殖系统：</strong></p>
                <p>• 蚁群达到 <strong className="text-[#FF69B4]">50只</strong> 后可产繁殖蚁卵（3食物）</p>
                <p>• 繁殖蚁分为 <strong className="text-[#2c2c2c]">雄蚁</strong> 和 <strong className="text-[#4a2c5e]">雌蚁</strong>，带翅膀</p>
                <p>• 繁殖蚁孵化后会 <strong className="text-[#87CEEB]">飞向野外</strong></p>
                <p>• 在野外交配后，雌蚁成为 <strong className="text-[#FFD700]">新蚁后</strong></p>
                <hr className="border-[#4a3520]" />
                <p>🌿 <strong className="text-[#daa520]">野外场景：</strong></p>
                <p>• 点击顶部 <strong className="text-[#87CEEB]">🌿野外</strong> 按钮切换到野外</p>
                <p>• 野外有繁殖蚁和可捕捉的蚁后</p>
                <p>• 使用 <strong className="text-[#FFD700]">🪤捕捉</strong> 工具捕捉野外蚁后</p>
                <p>• 野外每30秒有 <strong>10%</strong> 概率刷新新蚁后</p>
                <p>• 捕捉的蚁后会带回巢穴，可以产卵</p>
                <hr className="border-[#4a3520]" />
                <p>⏳ <strong className="text-[#daa520]">寿命系统：</strong></p>
                <p>• 工蚁寿命约 <strong>90秒</strong>（头顶有寿命条）</p>
                <p>• 兵蚁寿命约 <strong>120秒</strong></p>
                <p>• 蚁后 <strong className="text-[#FFD700]">永生</strong></p>
                <p>• 蚂蚁死后会从蚁群中消失</p>
                <hr className="border-[#4a3520]" />
                <p>🎮 <strong className="text-[#daa520]">视角控制：</strong></p>
                <p>• <strong>WASD/方向键</strong> - 移动视角</p>
                <p>• <strong>鼠标滚轮</strong> - 缩放（0.5x ~ 3x）</p>
                <p>• <strong>空格键</strong> - 快速回到蚁巢中心</p>
                <p>• <strong>右键拖拽</strong> - 平移视角</p>
                <p>• <strong>鼠标靠近边缘</strong> - 自动滚动</p>
                <p>• <strong>触摸滑动</strong> - 移动端拖动/双指缩放</p>
                <p>• 右上角按钮可控制缩放、回中心、小地图</p>
                <hr className="border-[#4a3520]" />
                <p>🖱️ <strong className="text-[#daa520]">操作：</strong>左键放置食物 | 右键拖拽视角</p>
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
        <span>WASD/方向键移动 | 滚轮缩放 | 空格回中心 | 左键放置 | 右键拖拽</span>
        <span>像素蚂蚁饲养 v3.0 | {FOOD_PER_EGG}食物→1卵 | 缩放: {Math.round(zoom * 100)}%</span>
      </div>
    </div>
  )
}

export default App
