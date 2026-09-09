import { Link } from 'react-router-dom'
import Button from './Button'
import SeoMeta from './SeoMeta'

export default function NotFoundPage() {
  return <main className="mx-auto max-w-xl p-8">
    <SeoMeta title="找不到頁面｜放射師國考刷題庫" robots="noindex,nofollow" />
    <h1 className="text-2xl font-black">找不到這個頁面</h1>
    <p className="my-4">網址可能已變更，請從科目列表繼續練習。</p>
    <Button as={Link} to="/radiographer">返回科目選擇</Button>
  </main>
}
