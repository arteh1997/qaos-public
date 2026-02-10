import { CategoryList } from '@/components/categories/CategoryList'

interface CategoryPageProps {
  params: Promise<{ storeId: string }>
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { storeId } = await params

  return (
    <div className="container py-8">
      <CategoryList storeId={storeId} />
    </div>
  )
}
