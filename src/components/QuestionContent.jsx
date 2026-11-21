import { officialQuestionLink } from '../utils/officialSources'
import QuestionFigureViewer from './QuestionFigureViewer'
import { useEffect, useState } from 'react'
const IMAGE_PLACEHOLDER_PATTERN = /\{\{image:([^}]+)\}\}/g

function QuestionImage({ src, alt, className, allowRetry = true }) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(()=>{setFailed(false);setAttempt(0)},[src])
  if (failed) return <div role="status" className="p-4 text-sm text-slate-700">
    附圖未能載入，可能是檔案缺漏或連線問題。可重試或查看本卷官方原題，勿依缺圖判斷答案。
    {allowRetry && <button type="button" className="ml-2 font-bold underline" onClick={(event) => { event.stopPropagation(); setFailed(false); setAttempt((value) => value + 1) }}>重試圖片</button>}
  </div>
  return <img key={`${src}-${attempt}`} src={src} alt={alt || '題目附圖'} loading="lazy" decoding="async" onError={() => setFailed(true)} className={`question-image ${className}`} />
}

export function resolveQuestionImagePath(rawPath = '') {
  const normalizedPath = String(rawPath).replace(/\\/g, '/').trim()

  if (!normalizedPath) {
    return ''
  }

  const fileName = normalizedPath.split('/').pop()

  if (!fileName) {
    return normalizedPath
  }

  if (
    normalizedPath.startsWith('/uploads/') ||
    normalizedPath.startsWith('http://') ||
    normalizedPath.startsWith('https://') ||
    normalizedPath.startsWith('data:')
  ) {
    return normalizedPath
  }

  return `/uploads/${fileName}`
}

function buildImageTextSegments(text = '') {
  const sourceText = String(text)
  const segments = []
  let lastIndex = 0

  sourceText.replaceAll(IMAGE_PLACEHOLDER_PATTERN, (match, imagePath, offset) => {
    if (offset > lastIndex) {
      segments.push({
        type: 'text',
        value: sourceText.slice(lastIndex, offset),
      })
    }

    segments.push({
      type: 'image',
      src: resolveQuestionImagePath(imagePath),
      rawPath: imagePath,
    })

    lastIndex = offset + match.length
    return match
  })

  if (lastIndex < sourceText.length) {
    segments.push({
      type: 'text',
      value: sourceText.slice(lastIndex),
    })
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: sourceText }]
}

export function QuestionRichText({
  text,
  alt,
  allowRetry = true,
  textClassName = 'whitespace-pre-line leading-relaxed text-slate-900',
  imageClassName = 'w-full object-contain',
}) {
  // PDF extraction can split one figure into consecutive horizontal strips.
  // Keep adjacent image placeholders together, with no artificial gaps or crops.
  const segments = []
  for (const segment of buildImageTextSegments(text)) {
    if (segment.type === 'text' && !segment.value.trim()) continue
    if (segment.type === 'image') {
      if (segments.at(-1)?.type === 'images') segments.at(-1).images.push(segment)
      else segments.push({ type: 'images', images: [segment] })
    } else segments.push(segment)
  }

  return (
    <div className="space-y-3">
      {segments.map((segment, index) => {
        if (segment.type === 'images') {
          return (
            <figure
              key={`${alt}-image-${index}`}
              className="mx-auto w-fit max-w-full overflow-hidden border border-slate-200 bg-white"
            >
              {segment.images.map((part, imageIndex) => <QuestionImage allowRetry={allowRetry} key={`${part.src}-${imageIndex}`} src={part.src} alt={alt} className={imageClassName} />)}
            </figure>
          )
        }

        if (!segment.value.trim()) {
          return null
        }

        return (
          <p key={`${alt}-text-${index}`} className={textClassName}>
            {segment.value}
          </p>
        )
      })}
    </div>
  )
}

function QuestionContent({ question }) {
  const official = officialQuestionLink(question)
  return (
    <div className="space-y-5">
      <QuestionFigureViewer question={question} />
      <a href={official.url} target="_blank" rel="noreferrer" className="inline-block text-base font-semibold text-blue-700 underline">{official.direct ? '查看本卷官方原題 PDF（含完整附圖）' : '前往考選部查詢原題（本題尚無直接來源對照）'}</a>
      <div className="text-xl font-bold md:text-2xl">
        <QuestionRichText text={question.question || question.questionText || question.stem} alt="題目附圖" />
      </div>

      {question.image && (
        <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <QuestionImage
            src={resolveQuestionImagePath(typeof question.image === 'string' ? question.image : question.image.src)}
            alt={question.image.alt || question.question}
            className="w-full object-contain"
          />
          {question.image.caption && (
            <figcaption className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
              {question.image.caption}
            </figcaption>
          )}
        </figure>
      )}

      {question.table && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm text-slate-700">
              {question.table.caption && (
                <caption className="border-b border-slate-200 px-4 py-3 text-left font-medium text-slate-500">
                  {question.table.caption}
                </caption>
              )}
              <thead className="bg-slate-50">
                <tr>
                  {question.table.headers.map((header) => (
                    <th
                      key={header}
                      className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {question.table.rows.map((row, rowIndex) => (
                  <tr key={`${question.id}-row-${rowIndex}`} className="odd:bg-white even:bg-slate-50/60">
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${question.id}-cell-${rowIndex}-${cellIndex}`}
                        className="border-t border-slate-100 px-4 py-3 align-top"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuestionContent
