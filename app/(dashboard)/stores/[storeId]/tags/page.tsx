import { TagList } from '@/components/tags/TagList'

interface TagPageProps {
  params: Promise<{ storeId: string }>
}

export default async function TagPage({ params }: TagPageProps) {
  const { storeId } = await params

  return (
    <div className="container py-8">
      <TagList storeId={storeId} />
    </div>
  )
}
