import { memo, useEffect, useId, useRef } from 'react'
import * as d3 from 'd3'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  positive?: boolean
}

// memo: the dashboard renders hundreds of these; sort/filter/theme changes
// keep the same data references, so skipping re-renders avoids redrawing
// every SVG through D3.
export const Sparkline = memo(function Sparkline({ data, width = 80, height = 28, positive = true }: SparklineProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gradId = useId()

  useEffect(() => {
    if (!svgRef.current || data.length < 2) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const xScale = d3.scaleLinear().domain([0, data.length - 1]).range([0, width])
    const yExtent = d3.extent(data) as [number, number]
    const yPad = (yExtent[1] - yExtent[0]) * 0.1 || 1
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([height - 2, 2])

    const line = d3.line<number>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d))
      .curve(d3.curveCatmullRom.alpha(0.5))

    const area = d3.area<number>()
      .x((_, i) => xScale(i))
      .y0(height)
      .y1(d => yScale(d))
      .curve(d3.curveCatmullRom.alpha(0.5))

    const color = positive ? '#48bb78' : '#fc8181'

    const defs = svg.append('defs')
    const grad = defs.append('linearGradient')
      .attr('id', gradId)
      .attr('x1', '0').attr('y1', '0')
      .attr('x2', '0').attr('y2', '1')

    grad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.35)
    grad.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0.02)

    svg.append('path')
      .datum(data)
      .attr('fill', `url(#${gradId})`)
      .attr('d', area)

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .attr('d', line)

    const last = data[data.length - 1]
    svg.append('circle')
      .attr('cx', xScale(data.length - 1))
      .attr('cy', yScale(last))
      .attr('r', 2)
      .attr('fill', color)

  }, [data, width, height, positive, gradId])

  return <svg ref={svgRef} width={width} height={height} style={{ display: 'block' }} />
}, (prev, next) =>
  // Compare data element-wise: callers pass fresh .slice() arrays, so a
  // reference check alone would defeat the memo.
  prev.width === next.width &&
  prev.height === next.height &&
  prev.positive === next.positive &&
  prev.data.length === next.data.length &&
  prev.data.every((v, i) => v === next.data[i])
)
