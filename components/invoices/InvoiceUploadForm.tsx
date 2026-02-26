'use client'

import { useState, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useUploadInvoice } from '@/hooks/useInvoices'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, Camera, FileText, X, Loader2 } from 'lucide-react'
import { INVOICE_FILE_CONFIG } from '@/lib/validations/invoices'
import { cn } from '@/lib/utils'

interface InvoiceUploadFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const ACCEPT = INVOICE_FILE_CONFIG.allowedMimeTypes.join(',')
const MAX_SIZE_MB = INVOICE_FILE_CONFIG.maxSizeBytes / (1024 * 1024)

export function InvoiceUploadForm({ open, onOpenChange, onSuccess }: InvoiceUploadFormProps) {
  const { currentStore } = useAuth()
  const storeId = currentStore?.store_id
  const { suppliers } = useSuppliers(storeId ?? null)
  const upload = useUploadInvoice(storeId)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState<string>('')
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const resetForm = useCallback(() => {
    setFile(null)
    setPreview(null)
    setSupplierId('')
    setDragActive(false)
  }, [])

  const handleFile = useCallback((f: File) => {
    if (!INVOICE_FILE_CONFIG.allowedMimeTypes.includes(f.type as typeof INVOICE_FILE_CONFIG.allowedMimeTypes[number])) {
      return
    }
    if (f.size > INVOICE_FILE_CONFIG.maxSizeBytes) {
      return
    }
    setFile(f)
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleSubmit = async () => {
    if (!file || !storeId) return
    const formData = new FormData()
    formData.append('file', file)
    if (supplierId) formData.append('supplier_id', supplierId)

    upload.mutate(formData, {
      onSuccess: () => {
        resetForm()
        onOpenChange(false)
        onSuccess?.()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Invoice</DialogTitle>
          <DialogDescription>
            Upload a supplier invoice and we&apos;ll extract the line items automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                dragActive ? 'border-ring bg-ring/5' : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
              )}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Drop invoice here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, JPEG, PNG, WebP &middot; Max {MAX_SIZE_MB}MB
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Browse Files
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click() }}>
                  <Camera className="h-3.5 w-3.5 mr-1.5" />
                  Take Photo
                </Button>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                {preview ? (
                  <img src={preview} alt="Invoice preview" className="w-16 h-20 object-cover rounded border" />
                ) : (
                  <div className="w-16 h-20 bg-muted rounded border flex items-center justify-center">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(file.size / 1024).toFixed(0)} KB &middot; {file.type.split('/')[1]?.toUpperCase()}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Hidden inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
          />

          {/* Optional supplier selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Supplier (optional)</label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Auto-detect from invoice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Auto-detect from invoice</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              If known, selecting the supplier improves item matching accuracy.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false) }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!file || upload.isPending}>
            {upload.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload &amp; Process
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
