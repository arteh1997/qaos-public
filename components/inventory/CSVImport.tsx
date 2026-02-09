'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, Upload, Loader2, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'

interface CSVImportProps {
  storeId: string
  onSuccess?: () => void
  showCard?: boolean
}

interface ImportError {
  row: number
  errors: string[]
  data: {
    name: string
    category: string
    unit: string
    par_level?: string
  }
}

export function CSVImport({ storeId, onSuccess, showCard = true }: CSVImportProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    message: string
    itemsImported?: number
    categories?: string[]
    errors?: ImportError[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`/api/stores/${storeId}/inventory/template`)
      if (!response.ok) throw new Error('Failed to download template')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'inventory-template.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success('Template downloaded successfully')
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download template')
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file')
      return
    }

    setIsUploading(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/stores/${storeId}/inventory/import`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        setImportResult({
          success: true,
          message: result.message,
          itemsImported: result.data.itemsImported,
          categories: result.data.categories,
        })
        toast.success(result.message)
        onSuccess?.()
      } else {
        setImportResult({
          success: false,
          message: result.message,
          errors: result.errors,
        })
        toast.error(result.message)
      }
    } catch (error) {
      console.error('Upload error:', error)
      setImportResult({
        success: false,
        message: 'Failed to upload file',
      })
      toast.error('Failed to upload file')
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const content = (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Instructions */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">How to import:</h4>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Download the CSV template</li>
          <li>Fill in your inventory items with their categories, units, and par levels</li>
          <li>Upload the completed CSV file</li>
        </ol>
      </div>

      {/* CSV Format Info */}
      <Alert>
        <FileSpreadsheet className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Required columns:</strong> name, category, unit, par_level (optional)
          <br />
          <strong>Suggested units:</strong> kg, g, lb, oz, liter, gallon, each, case, box, bag, bottle, can, pack
          <br />
          <span className="text-muted-foreground">You can use any unit that works for your restaurant!</span>
        </AlertDescription>
      </Alert>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleDownloadTemplate}
          className="flex-1"
        >
          <Download className="mr-2 h-4 w-4" />
          Download Template
        </Button>
        <Button
          type="button"
          onClick={handleFileSelect}
          disabled={isUploading}
          className="flex-1"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload CSV
            </>
          )}
        </Button>
      </div>

      {/* Import Result */}
      {importResult && (
        <Alert variant={importResult.success ? 'default' : 'destructive'}>
          {importResult.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">{importResult.message}</p>
              {importResult.success && importResult.itemsImported && (
                <div className="text-sm">
                  <p>Imported {importResult.itemsImported} item(s)</p>
                  {importResult.categories && importResult.categories.length > 0 && (
                    <p className="text-muted-foreground mt-1">
                      Categories: {importResult.categories.join(', ')}
                    </p>
                  )}
                </div>
              )}
              {!importResult.success && importResult.errors && (
                <div className="text-sm space-y-2 mt-2">
                  <p className="font-medium">Errors found in rows:</p>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {importResult.errors.map((error, index) => (
                      <div key={index} className="border-l-2 border-destructive pl-2">
                        <p className="font-medium">Row {error.row}: {error.data.name || '(unnamed)'}</p>
                        <ul className="list-disc list-inside text-xs">
                          {error.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )

  if (!showCard) {
    return content
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import from CSV</CardTitle>
        <CardDescription>
          Quickly add multiple inventory items by uploading a CSV file
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  )
}
