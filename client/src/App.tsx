import React, { useEffect, useMemo, useState } from 'react'
import io from 'socket.io-client'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { createClient } from '@supabase/supabase-js'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = SUPABASE_URL ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

type DataKV = Record<string, string>

type SheetPayload = {
  data: DataKV
  lastUpdated: string | null
  lastError: string | null
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'
const socket = io(SERVER_URL)

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#94a3b8', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b']

const LABEL_COLORS: Record<string, string> = {
  Passed: '#22c55e',
  Failed: '#ef4444',
  Blocked: '#f59e0b',
  'Not Started': '#94a3b8',
  'Not Applicable': '#8b5cf6',
}

function colorForLabel(label: string, index: number): string {
  return LABEL_COLORS[label] ?? COLORS[index % COLORS.length]
}

function parseNumeric(value: string): number {
  const cleaned = value.replace(/[%$,]/g, '').trim()
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

function isPercentMetric(value: string): boolean {
  return value.includes('%')
}

function isCountMetric(label: string, value: string): boolean {
  return !isPercentMetric(value) && label !== 'Total Test Cases'
}

function isRateLabel(label: string): boolean {
  const rateLabels = ['Pass Rate', 'Fail Rate', 'Pass %', 'Fail %', 'Passed %', 'Failed %']
  return rateLabels.includes(label)
}

function getBaseCountKey(label: string): string | null {
  if (label.toLowerCase().includes('pass')) return 'Passed'
  if (label.toLowerCase().includes('fail')) return 'Failed'
  return null
}

function isProgressLabel(label: string): boolean {
  const progressLabels = ['Execution Progress', 'Progress', 'Completion %', 'Test Progress']
  return progressLabels.includes(label) || label.toLowerCase().includes('progress')
}

export default function App() {
  const [payload, setPayload] = useState<SheetPayload>({ data: {}, lastUpdated: null, lastError: null })
  const [dashboardTitle, setDashboardTitle] = useState('QA Dashboard')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')

  useEffect(() => {
    const onData = (p: SheetPayload) => setPayload(p)
    socket.on('sheetData', onData)
    fetch(`${SERVER_URL}/api/data`)
      .then(r => r.json())
      .then(j => setPayload({ data: j.data ?? {}, lastUpdated: j.lastUpdated, lastError: j.lastError }))
      .catch(() => {})
    return () => { socket.off('sheetData', onData) }
  }, [])

  useEffect(() => {
    if (supabase) {
      supabase.from('dashboard_settings').select('title').eq('id', 1).single()
        .then(({ data }) => {
          if (data?.title) setDashboardTitle(data.title)
        })
    }
  }, [])

  const handleTitleEdit = () => {
    setTitleInput(dashboardTitle)
    setIsEditingTitle(true)
  }

  const handleTitleSave = async () => {
    const newTitle = titleInput.trim() || 'QA Dashboard'
    setDashboardTitle(newTitle)
    setIsEditingTitle(false)
    if (supabase) {
      await supabase.from('dashboard_settings').update({ title: newTitle, updated_at: new Date().toISOString() }).eq('id', 1)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTitleSave()
    if (e.key === 'Escape') setIsEditingTitle(false)
  }

  const { data, lastUpdated, lastError } = payload
  const labels = useMemo(() => Object.keys(data), [data])
  const values = useMemo(() => labels.map(l => parseNumeric(data[l])), [labels, data])

  const statusLabels = ['Passed', 'Failed', 'Blocked', 'Not Started', 'Not Applicable']
  const statusTotal = useMemo(() => {
    return statusLabels.reduce((sum, l) => sum + parseNumeric(data[l] || ''), 0)
  }, [data])

  const chartLabels = useMemo(
    () => labels.filter(l => statusLabels.includes(l)),
    [labels]
  )
  const chartValues = useMemo(() => chartLabels.map(l => parseNumeric(data[l])), [chartLabels, data])
  const chartColors = useMemo(
    () => chartLabels.map((l, i) => colorForLabel(l, i)),
    [chartLabels]
  )

  const doughnutData = {
    labels: chartLabels,
    datasets: [{ data: chartValues, backgroundColor: chartColors, borderWidth: 0 }],
  }

  const barData = {
    labels: chartLabels,
    datasets: [{ label: 'Count', data: chartValues, backgroundColor: chartColors, borderRadius: 6 }],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { position: 'bottom' as const } },
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-title-area">
          {isEditingTitle ? (
            <input
              type="text"
              className="title-input"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleSave}
              autoFocus
            />
          ) : (
            <h1 onClick={handleTitleEdit} className="editable-title" title="Click to edit">
              {dashboardTitle}
            </h1>
          )}
        </div>
        <div className="status">
          {lastError ? (
            <span className="badge badge-error">Error: {lastError}</span>
          ) : (
            <span className="badge badge-ok">Live</span>
          )}
          {lastUpdated && (
            <span className="timestamp">Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
          )}
        </div>
      </header>

      {labels.length === 0 ? (
        <div className="empty">
          <p>Waiting for sheet data…</p>
          <p className="hint">
            Make the spreadsheet public, or add a Google service account key in <code>server/.env</code>.
          </p>
        </div>
      ) : (
        <>
          <section className="cards">
            {labels.filter(l => !isProgressLabel(l)).map((label, i) => {
              const isRate = isRateLabel(label)
              const baseKey = getBaseCountKey(label)
              const baseCount = baseKey ? parseNumeric(data[baseKey] || '') : 0

              return (
                <div key={label} className="card" style={{ borderTopColor: colorForLabel(label, labels.indexOf(label)) }}>
                  <span className="card-label">{label}</span>
                  <span className="card-value">{data[label]}</span>
                  {isRate && baseCount > 0 && statusTotal > 0 && (
                    <span className="card-pct">{baseCount} of {statusTotal} total</span>
                  )}
                  {!isRate && isCountMetric(label, data[label]) && statusLabels.includes(label) && statusTotal > 0 && (
                    <span className="card-pct">{((values[labels.indexOf(label)] / statusTotal) * 100).toFixed(1)}% of total</span>
                  )}
                </div>
              )
            })}
          </section>

          {labels.some(isProgressLabel) && (
            <section className="progress-section">
              {labels.filter(isProgressLabel).map(label => {
                const value = parseNumeric(data[label])
                const percent = Math.min(100, Math.max(0, value))

                return (
                  <div key={label} className="progress-card">
                    <div className="progress-header">
                      <span className="progress-label">{label}</span>
                      <span className="progress-value">{data[label]}</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </section>
          )}

          <section className="charts">
            <div className="chart-panel">
              <h2>Distribution</h2>
              <Doughnut data={doughnutData} options={chartOptions} />
            </div>
            <div className="chart-panel">
              <h2>Comparison</h2>
              <Bar
                data={barData}
                options={{
                  ...chartOptions,
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
          </section>

          <section className="table-section">
            <h2>Raw data</h2>
            <table>
              <thead>
                <tr><th>Label (A)</th><th>Value (B)</th></tr>
              </thead>
              <tbody>
                {labels.map(label => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{data[label]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}
