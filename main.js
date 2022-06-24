// phina.jsをグローバル領域に展開
phina.globalize()

/* ゲーム設定 */
// 別ファイルにまとめようとしたらCORSエラーになった

// 画面サイズ
const SCREEN_W = 960
const SCREEN_H = 1280

const CELL_COUNT_X = Math.floor(Math.random() * 4) + 8
const CELL_COUNT_Y = Math.floor(Math.random() * 4) + 6

// 盤のサイズ
const BOARD_MARGIN = 30
const BOARD_PADDING = 0
const BOARD_SIZE = SCREEN_W - (BOARD_MARGIN * 2)

// マス
const CELL_COUNT = CELL_COUNT_X * CELL_COUNT_Y
const CELL_SIZE = (BOARD_SIZE - (BOARD_PADDING * 2)) / CELL_COUNT_X
const CELL_PADDING = 10
const CELL_OFFSET = CELL_SIZE / 2 // 中心が基準だと扱いにくいから必要
const NUM_SIZE = CELL_SIZE * 0.6

const BOMB_COUNT = Math.floor(Math.random() * CELL_COUNT / 10) + 5
const CLEAR = CELL_COUNT - BOMB_COUNT

const fontFamily = "'Comic Sans MS'"
const color = {
  dark: {
    RED: "#9D5456",
    YELLOW: "#A6813F",
    GREEN: "#40834D",
    BLUE: "#236077",
    PURPLE: "#5E496C"
  },
  light: {
    RED: "#E9B8B8",
    YELLOW: "#EFD5AE",
    GREEN: "#A6D0AB",
    BLUE: "#A6C6D5",
    PURPLE: "#C0B1C7"
  }
}

/* 関数 */
// 爆弾をセットするマスを返す
function getBombIndex() {
  const indexes = []

  while(indexes.length < BOMB_COUNT) {
    const randX = Math.floor(Math.random() * CELL_COUNT_X)
    const randY = Math.floor(Math.random() * CELL_COUNT_Y)
    const index = `${randX}-${randY}`

    // 重複してなければ対象に追加
    if (!indexes.includes(index)) {
      indexes.push(index)
    }
  }
  return indexes
}

// 隣接するマスを返す
function getCellAround(x, y, i) {
  const index = []

  const needUp = y > 0
  const needDown = y < CELL_COUNT_Y - 1
  const needLeft = x > 0
  const needRight = x < CELL_COUNT_X - 1

  const column = [needLeft, true, needRight]
  const row = [needUp, true, needDown]

  column.forEach((needC, j) => {
    const c = i + (CELL_COUNT_Y * (j - 1)) // 横方向のセルindex
    row.forEach((needR, k) => {
      const r = c + (k - 1) // 縦方向に移動したセルindex
      if (needC && needR && (r !== i)) {
        index.push(r)
      }
    })
  })
  return index
}

// 隣接するマスの爆弾の個数を返す
function countBombsAround(x, y, cells, i) {
  const aroundIndex = getCellAround(x, y, i)
  return aroundIndex.filter(j => cells[j].isBomb).length
}

// マスを開く
function openCell(cell, field) {
  if (cell.isOpen) {
    return
  }

  cell.isOpen = true
  cell.fill = color.light.GREEN
  Label({
    text: cell.num || "", // 0は表示しない
    y: CELL_OFFSET - CELL_PADDING - (NUM_SIZE / 2),
    fontSize: NUM_SIZE,
    fontFamily
  })
    .addChildTo(cell)

  // 0の場合は隣接するマスも開く
  if (cell.num === 0) {
    const cells = field.children
    const i = (CELL_COUNT_Y * cell.noX) + cell.noY
    const aroundIndex = getCellAround(cell.noX, cell.noY, i)

    aroundIndex.forEach(index => {
      openCell(cells[index], field)
    })
  }

  field.count++
}

// 数字マスの周辺を開く
function openCellAround(cell, field) {
  const cells = field.children
  const i = (CELL_COUNT_Y * cell.noX) + cell.noY
  const aroundIndex = getCellAround(cell.noX, cell.noY, i)
  const lockedNum = aroundIndex.filter(index => cells[index].isLocked).length

  // 隣接するマスの爆弾をすべて指定しきっている場合は空きマスを開く
  if (lockedNum === cell.num) {
    aroundIndex.forEach(index => {
      if (!cells[index].isLocked) {
        openCell(cells[index], field)
      }
    })
  }
}

/* Titleシーン */
phina.define("TitleScene", {
  superClass: "DisplayScene",
  init: function() {
    this.superInit({ width: SCREEN_W, height: SCREEN_H })

    // 背景色指定
    this.backgroundColor = color.light.YELLOW
    // タイトル生成
    Label({
      text: "MINE SWEEPER",
      x: this.gridX.center(),
      y: this.gridY.span(4),
      fill: color.dark.GREEN,
      fontSize: 64,
      fontFamily
    })
      .addChildTo(this)

    Label({
      text: "TOUCH START",
      x: this.gridX.center(),
      y: this.gridY.span(12),
      fontSize: 36,
      fontFamily,
      fill: color.dark.GREEN
    })
      .addChildTo(this)

    this.onpointstart = () => {
      this.exit()
    }
  }
})

/* Mainシーン */
phina.define("MainScene", {
  // 継承: tutorialにあるCanvasSceneは非推奨warningが出る
  superClass: "DisplayScene",

  // Arrow関数だとthisがエラー
  init: function() {
    // 親クラスの初期化
    this.superInit({ width: SCREEN_W, height: SCREEN_H })
    // 背景色指定
    this.backgroundColor = color.light.PURPLE

    /* 爆弾の数を表示 */
    Label({
      text: `BOMBS: ${BOMB_COUNT}`,
      x: this.gridX.span(3),
      y: this.gridY.span(1),
      fill: color.dark.GREEN,
      fontSize: 48,
      fontFamily
    })
      .addChildTo(this)

    /* 盤の用意 */
    const board = {
      // 横・縦方向にそれぞれ配置用の基準を持つ
      x: Grid(CELL_SIZE * CELL_COUNT_X, CELL_COUNT_X),
      y: Grid(CELL_SIZE * CELL_COUNT_Y, CELL_COUNT_Y)
    }
    /* マスの配置 */
    // 爆弾マスを決める
    const bombIndex = getBombIndex()

    // マスをグループ化して扱う
    const field = DisplayElement({
      x: BOARD_MARGIN,
      y: this.gridY.center() - (CELL_SIZE * CELL_COUNT_Y / 2)
    })
      .addChildTo(this)
    field.count = 0 // 開いたマスの数

    // (n).times(func(i){})でn回ループ
    CELL_COUNT_X.times(x => {
      CELL_COUNT_Y.times(y => {
        const cell = RectangleShape({
          width: CELL_SIZE - CELL_PADDING,
          height: CELL_SIZE - CELL_PADDING,
          x: board.x.span(x) + CELL_OFFSET,
          y: board.y.span(y) + CELL_OFFSET,
          fill: color.dark.GREEN,
          stroke: color.dark.GREEN,
          cornerRadius: 8
        })
          .addChildTo(field)
          .setInteractive(true) // タッチ有効化

        cell.noX = x // X軸方向の識別子
        cell.noY = y // Y軸方向の識別子
        cell.num = 0 // 隣接する爆弾の数
        cell.isOpen = false // 開き済みかどうか
        cell.isBomb = bombIndex.includes(`${x}-${y}`) // 爆弾かどうか
        cell.isLocked = false // 右クリックでロックされてるかどうか

        cell.on("pointstart", (e) => {
          // 右クリックホールドイベント対応
          if (e.pointer.start === 0) {
            return
          }

          // すでに開いている0マス
          if (cell.isOpen && cell.num === 0) {
            return
          }

          /* 右クリック */
          const isRight = e.pointer.start === 4
          if (isRight) {
            cell.isLocked = !cell.isLocked
            cell.fill = cell.isLocked ? color.dark.RED : color.dark.GREEN
            return
          }

          /* 左クリック */

          if (cell.isLocked) {
            return
          }

          if (cell.isBomb) {
            this.exit()
            return
          }

          // マスを開く
          if (cell.isOpen && cell.num > 0) {
            openCellAround(cell, field)
          } else {
            openCell(cell, field)
          }

          // 終了判定
          if (field.count >= CLEAR) {
            this.exit({ completed: true })
          }
        })
      })
    })

    // マスに数字をセット
    field.children.forEach((cell, i, cells) => {
      if (cell.isBomb) {
        cell.num = -1
      } else {
        cell.num = countBombsAround(cell.noX, cell.noY, cells, i)
      }
    })
  }
})

/* Resultシーン */
phina.define("ResultScene", {
  superClass: "DisplayScene",
  init: function(param) {
    param.width = SCREEN_W
    param.height = SCREEN_H
    this.superInit(param)

    const { completed = false } = param

    if (completed) {
      // クリア
      this.backgroundColor = color.light.BLUE
      Label({
        text: "COMPLETED !!",
        x: this.gridX.center(),
        y: this.gridY.span(7),
        fill: color.dark.PURPLE,
        fontSize: 128,
        fontFamily
      })
        .addChildTo(this)
    } else {
      // ミス
      this.backgroundColor = color.light.RED
      Label({
        text: "GAME OVER",
        x: this.gridX.center(),
        y: this.gridY.span(7),
        fill: color.dark.YELLOW,
        fontSize: 128,
        fontFamily
      })
        .addChildTo(this)
    }

    // タイトルに戻るボタン作成
    const resetBtn = Button({
      text: "REPLAY",
      x: this.gridX.center(),
      y: this.gridY.span(10),
      fill: color.dark.BLUE,
      fontSize: 36,
      fontColor: color.light.BLUE,
      fontFamily
    })
      .addChildTo(this)

    // 右クリックで遷移してきたとき無視したいのでButton.onpush()は使えない
    resetBtn.on("pointstart", (e) => {
      const isLeft = e.pointer.now === 1
      if (isLeft) {
        this.exit()
      }
    })
  }
})

/* メイン処理*/
phina.main(() => {
  const app = GameApp({
    /* シーン */
    // startLabel: "title", // 開始シーンのラベル
    // scenes: [ // splash→title→main→result 以外の流れのときに指定
    //   {
    //     className: "TitleScene",
    //     label: "title",
    //     nextLabel: "main"
    //   },
    //   {
    //     className: "MainScene",
    //     label: "main",
    //     nextLabel: "result"
    //   },
    //   {
    //     className: "ResultScene",
    //     label: "result",
    //     nextLabel: "title"
    //   }
    // ],
    width: SCREEN_W,
    height: SCREEN_H,
  })
  app.run()
})

/* 右クリックイベント取得のためにMouseクラスを上書き */
;(function() {
  /**
   * @class phina.input.Mouse
   * @extends phina.input.Input
   */
  phina.define("phina.input.Mouse", {
    superClass: "phina.input.Input",

    /**
     * @constructor
     */
    init: function(domElement) {
      this.superInit(domElement)
      this.id = 0

      var self = this
      this.domElement.addEventListener("mousedown", function(e) {
        self._start(e.pointX, e.pointY, 1<<e.button)
      })

      this.domElement.addEventListener("mouseup", function(e) {
        self._end(1<<e.button)
      })
      this.domElement.addEventListener("mousemove", function(e) {
        self._move(e.pointX, e.pointY)
      })

      // マウスがキャンバス要素の外に出た場合の対応
      this.domElement.addEventListener("mouseout", function(e)  {
        self._end(1)
      })
    },

    /**
     * ボタン取得
     */
    getButton: function(button) {
      if (typeof(button) == "string") {
        button = BUTTON_MAP[button]
      }
      return (this.now & button) != 0
    },

    /**
     * ボタンダウン取得
     */
    getButtonDown: function(button) {
      if (typeof(button) === "string") {
        button = BUTTON_MAP[button]
      }
      return (this.start & button) != 0
    },
        
    /**
     * ボタンアップ取得
     */
    getButtonUp: function(button) {
      if (typeof(button) == "string") {
        button = BUTTON_MAP[button]
      }
      return (this.end & button) != 0
    },

    _static: {
      /** @static @property */
      BUTTON_LEFT: 0x1,
      /** @static @property */
      BUTTON_MIDDLE: 0x2,
      /** @static @property */
      BUTTON_RIGHT: 0x4,
    }
  })

  var BUTTON_MAP = {
    "left"  : phina.input.Mouse.BUTTON_LEFT,
    "middle": phina.input.Mouse.BUTTON_MIDDLE,
    "right" : phina.input.Mouse.BUTTON_RIGHT
  }

  // 右クリックも反応させる
  phina.input.Mouse.prototype.getPointing = function() { return this.getButton("left") || this.getButton("right") }
  phina.input.Mouse.prototype.getPointingStart = function() { return this.getButtonDown("left") || this.getButton("right") }
  phina.input.Mouse.prototype.getPointingEnd = function() { return this.getButtonUp("left") || this.getButton("right") }
})()
