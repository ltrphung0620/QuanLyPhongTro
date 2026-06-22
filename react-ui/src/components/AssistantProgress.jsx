import { AlertCircle, CheckCircle2, ChevronDown, CircleDashed, Clock3, ListChecks } from 'lucide-react'
import './AssistantProgress.css'

export function layNoiDungTraLoi(response, fallback = 'Mình đã xử lý xong yêu cầu.') {
  const finalStepMessage = [...(response.agentExecution?.steps || [])]
    .reverse()
    .find((step) => step.outcome !== 'skipped' && step.message?.trim())
    ?.message

  if (response.intent === 'agent.completed' && finalStepMessage) {
    return finalStepMessage
  }

  return response.message || finalStepMessage || fallback
}

function layTrangThai(step) {
  if (step.responseType === 'confirmation_required') {
    return { label: 'Chờ xác nhận', tone: 'waiting', Icon: Clock3 }
  }
  if (step.responseType === 'need_more_info') {
    return { label: 'Cần bổ sung', tone: 'waiting', Icon: CircleDashed }
  }
  if (step.outcome === 'error' || step.responseType === 'error') {
    return { label: 'Chưa hoàn tất', tone: 'error', Icon: AlertCircle }
  }
  if (step.outcome === 'skipped') {
    return { label: 'Đã bỏ qua', tone: 'muted', Icon: CircleDashed }
  }
  return { label: 'Hoàn tất', tone: 'success', Icon: CheckCircle2 }
}

export default function AssistantProgress({ plan, execution, compact = false }) {
  if (!plan) return null

  const understood = plan.summary || plan.goal
  const steps = execution?.steps || []
  const completedCount = steps.filter((step) => layTrangThai(step).tone === 'success').length

  return (
    <div className={`assistant-progress ${compact ? 'assistant-progress--compact' : ''}`}>
      {understood && (
        <div className="assistant-progress__understood">
          <span>Đã hiểu yêu cầu</span>
          <strong>{understood}</strong>
        </div>
      )}

      {steps.length > 0 && (
        <details className="assistant-progress__details">
          <summary>
            <span><ListChecks size={16} /> Quá trình xử lý</span>
            <span className="assistant-progress__count">{completedCount}/{steps.length}</span>
            <ChevronDown className="assistant-progress__chevron" size={16} />
          </summary>
          <ol>
            {steps.map((step) => {
              const status = layTrangThai(step)
              const StatusIcon = status.Icon
              return (
                <li key={`${step.stepNumber}-${step.intent}`}>
                  <StatusIcon className={`assistant-progress__icon assistant-progress__icon--${status.tone}`} size={17} />
                  <div>
                    <span>{step.purpose || `Bước ${step.stepNumber}`}</span>
                    <small>{status.label}</small>
                  </div>
                </li>
              )
            })}
          </ol>
        </details>
      )}
    </div>
  )
}
