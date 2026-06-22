import { useState } from 'react'
import { Bot, Check, Loader2, MessageCircle, Send, X } from 'lucide-react'
import { guiTinNhanAssistant, thucThiLenhAssistant } from '../api'
import AssistantProgress, { layNoiDungTraLoi } from './AssistantProgress'

const GOI_Y = [
  'Nhập số điện tháng 10 phòng A1 là 1000',
  'Phòng nào còn trống?',
  'Hóa đơn nào chưa thanh toán tháng 10?'
]

function taoTinNhan(role, text, data = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    text,
    ...data
  }
}

export default function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [strongConfirmed, setStrongConfirmed] = useState(false)
  const [messages, setMessages] = useState([
    taoTinNhan('assistant', 'Bạn cần mình làm gì? Mình có thể nhập số điện, tìm phòng trống hoặc xem hóa đơn chưa thanh toán.')
  ])

  const guiTinNhan = async (text = input, displayText = null) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setInput('')
    setMessages((items) => [...items, taoTinNhan('user', displayText || trimmed)])
    setLoading(true)

    try {
      const response = await guiTinNhanAssistant(trimmed)
      setMessages((items) => [
        ...items,
        taoTinNhan('assistant', layNoiDungTraLoi(response), {
          commandId: response.commandId,
          command: response.command,
          type: response.type,
          preview: response.preview,
          result: response.result,
          pendingCommand: response.pendingCommand,
          agentPlan: response.agentPlan,
          agentExecution: response.agentExecution,
          suggestions: response.suggestions || [],
          actionSuggestions: response.actionSuggestions || [],
          requiresStrongConfirmation: response.requiresStrongConfirmation
        })
      ])
    } catch (error) {
      setMessages((items) => [...items, taoTinNhan('assistant', error.message || 'Có lỗi khi xử lý yêu cầu.')])
    } finally {
      setLoading(false)
    }
  }

  const xacNhanLenh = async (commandId, requiresStrong) => {
    if (!commandId || loading) return
    setLoading(true)

    try {
      const response = await thucThiLenhAssistant(commandId, requiresStrong)
      setMessages((items) => [
        ...items,
        taoTinNhan('assistant', response.message || 'Đã thực hiện xong.', {
          type: response.type,
          result: response.result
        })
      ])
      setStrongConfirmed(false)
    } catch (error) {
      setMessages((items) => [...items, taoTinNhan('assistant', error.message || 'Không thể thực hiện lệnh.')])
    } finally {
      setLoading(false)
    }
  }

  const submit = (event) => {
    event.preventDefault()
    guiTinNhan()
  }

  const xuLyPhimNhap = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      guiTinNhan()
    }
  }

  return (
    <div className={`assistant-widget ${open ? 'assistant-widget--open' : ''}`}>
      {open && (
        <section className="assistant-panel" aria-label="Trợ lý thao tác nhanh">
          <header className="assistant-panel__header">
            <div>
              <span className="assistant-panel__eyebrow">Trợ lý</span>
              <h2>Nhập lệnh nhanh</h2>
            </div>
            <button type="button" className="assistant-icon-btn" onClick={() => setOpen(false)} aria-label="Đóng trợ lý">
              <X size={18} />
            </button>
          </header>

          <div className="assistant-panel__messages">
            {messages.map((message) => (
              <article key={message.id} className={`assistant-message assistant-message--${message.role}`}>
                <p>{message.text}</p>
                <AssistantProgress plan={message.agentPlan} execution={message.agentExecution} compact />
                {message.type === 'confirmation_required' && message.commandId && (
                  <div className="assistant-confirm-wrapper">
                    {message.requiresStrongConfirmation && (
                      <div className="assistant-strong-confirm-checkbox" style={{ margin: '8px 0', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-warning, #d97706)' }}>
                        <input
                          type="checkbox"
                          id={`strong-confirm-${message.id}`}
                          checked={strongConfirmed}
                          onChange={(e) => setStrongConfirmed(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        <label htmlFor={`strong-confirm-${message.id}`} style={{ cursor: 'pointer', fontWeight: 500 }}>
                          Tôi xác nhận đồng ý thực hiện hành động này
                        </label>
                      </div>
                    )}
                    <div className="assistant-confirm-row">
                      <button
                        type="button"
                        className="assistant-confirm"
                        onClick={() => xacNhanLenh(message.commandId, message.requiresStrongConfirmation)}
                        disabled={loading || (message.requiresStrongConfirmation && !strongConfirmed)}
                      >
                        <Check size={16} />
                        Xác nhận thực hiện
                      </button>
                      <button type="button" className="assistant-reject" onClick={() => guiTinNhan('Không đúng')} disabled={loading}>
                        Không đúng
                      </button>
                    </div>
                  </div>
                )}
                {message.role === 'assistant' && (message.command || message.agentPlan) && message.type !== 'confirmation_required' && (
                  <div className="assistant-confirm-row">
                    <button type="button" className="assistant-reject" onClick={() => guiTinNhan('Không đúng')} disabled={loading}>
                      Không đúng
                    </button>
                  </div>
                )}
                {message.suggestions?.length > 0 && (
                  <div className="assistant-suggestions">
                    {message.suggestions.map((suggestion) => (
                      <button key={suggestion} type="button" onClick={() => guiTinNhan(suggestion)} disabled={loading}>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                {message.actionSuggestions?.length > 0 && (
                  <div className="assistant-action-suggestions">
                    {message.actionSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.intent}
                        type="button"
                        onClick={() => guiTinNhan(`__intent:${suggestion.intent}`, suggestion.label)}
                        disabled={loading}
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {loading && (
              <article className="assistant-message assistant-message--assistant">
                <p className="assistant-loading"><Loader2 size={15} /> Đang xử lý...</p>
              </article>
            )}
          </div>

          <div className="assistant-quick-row">
            {GOI_Y.map((text) => (
              <button key={text} type="button" onClick={() => guiTinNhan(text)} disabled={loading}>
                {text}
              </button>
            ))}
          </div>

          <form className="assistant-input" onSubmit={submit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={xuLyPhimNhap}
              placeholder="Ví dụ: nhập số điện tháng 10 phòng A1 là 1000"
              rows={2}
            />
            <button type="submit" aria-label="Gửi yêu cầu" disabled={loading || !input.trim()}>
              <Send size={17} />
            </button>
          </form>
        </section>
      )}

      <button type="button" className="assistant-fab" onClick={() => setOpen((value) => !value)} aria-label="Mở trợ lý">
        {open ? <X size={22} /> : <MessageCircle size={23} />}
        {!open && <Bot size={16} className="assistant-fab__bot" />}
      </button>
    </div>
  )
}
