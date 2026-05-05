'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  rates: number[]
  onChange: (next: number[]) => void
  baseRate: number
  minRate?: number
  maxRate?: number
}

export default function InterestRateCurve({
  rates,
  onChange,
  baseRate,
  minRate = 1,
  maxRate = 10,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const W = 320
  const H = 130
  const padX = 28
  const padY = 14

  const innerW = W - padX * 2
  const innerH = H - padY * 2
  const N = Math.max(rates.length - 1, 1)

  const xFor = (i: number) => padX + (i / N) * innerW
  const yFor = (rate: number) =>
    padY + (1 - (rate - minRate) / (maxRate - minRate)) * innerH

  const path = rates
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(r)}`)
    .join(' ')

  const handleStart = (idx: number) => (
    e: React.MouseEvent | React.TouchEvent,
  ) => {
    e.preventDefault()
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()

    const move = (clientY: number) => {
      const y = clientY - rect.top
      const ratio = (y - padY) / innerH
      const newRate = maxRate - ratio * (maxRate - minRate)
      const clamped = Math.max(minRate, Math.min(maxRate, newRate))
      const snapped = Math.round(clamped * 4) / 4 // snap to 0.25
      const next = [...rates]
      next[idx] = snapped
      onChange(next)
    }

    const onMouseMove = (ev: MouseEvent) => move(ev.clientY)
    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches.length > 0) move(ev.touches[0].clientY)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onUp)
  }

  // Y-axis tick lines (3 lines)
  const yTicks = [
    minRate,
    Math.round(((minRate + maxRate) / 2) * 2) / 2,
    maxRate,
  ]

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">📈 利率曲线（拖动每年的点）</p>
        <button
          type="button"
          onClick={() =>
            onChange(Array(rates.length).fill(Math.round(baseRate * 100) / 100))
          }
          className="text-[10px] text-blue-600 hover:underline"
        >
          重置为水平线
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none rounded-md border bg-white"
        style={{ maxWidth: '100%' }}
      >
        {/* gridlines */}
        {yTicks.map((r) => (
          <g key={r}>
            <line
              x1={padX}
              y1={yFor(r)}
              x2={W - padX}
              y2={yFor(r)}
              stroke="#e2e8f0"
              strokeDasharray="2 2"
            />
            <text
              x={4}
              y={yFor(r) + 3}
              fontSize="9"
              fill="#94a3b8"
            >
              {r.toFixed(1)}%
            </text>
          </g>
        ))}

        {/* baseline reference */}
        <line
          x1={padX}
          y1={yFor(baseRate)}
          x2={W - padX}
          y2={yFor(baseRate)}
          stroke="#cbd5e1"
          strokeDasharray="3 3"
          strokeWidth="0.5"
        />

        {/* x-axis labels */}
        {rates.map((_, i) => (
          <text
            key={i}
            x={xFor(i)}
            y={H - 2}
            fontSize="9"
            fill="#94a3b8"
            textAnchor="middle"
          >
            Y{i}
          </text>
        ))}

        {/* curve area fill */}
        <path
          d={`${path} L ${xFor(N)} ${H - padY} L ${xFor(0)} ${H - padY} Z`}
          fill="rgba(14, 165, 233, 0.08)"
        />

        {/* curve line */}
        <path d={path} stroke="#0ea5e9" strokeWidth="2" fill="none" />

        {/* draggable points */}
        {rates.map((r, i) => (
          <g key={i}>
            <circle
              cx={xFor(i)}
              cy={yFor(r)}
              r="10"
              fill="transparent"
              style={{ cursor: 'ns-resize' }}
              onMouseDown={handleStart(i)}
              onTouchStart={handleStart(i)}
            />
            <circle
              cx={xFor(i)}
              cy={yFor(r)}
              r="5"
              fill="#0ea5e9"
              stroke="white"
              strokeWidth="1.5"
              style={{ cursor: 'ns-resize', pointerEvents: 'none' }}
            />
            <text
              x={xFor(i)}
              y={yFor(r) - 9}
              fontSize="9"
              fill="#0f172a"
              textAnchor="middle"
              fontWeight="600"
              style={{ pointerEvents: 'none' }}
            >
              {r.toFixed(2)}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-[10px] leading-tight text-muted-foreground">
        默认水平 = 当前贷款利率。竖向拖动每年的点模拟升息/降息周期（每年初的利率）。每年 P&I 按新利率重算。
      </p>
    </div>
  )
}
