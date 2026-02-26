'use client'

import { useState, useCallback, useRef } from 'react'
import { useCSRF } from '@/hooks/useCSRF'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Upload, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { parseUserCSV, generateCSVTemplate, BulkUserRow } from '@/lib/validations/bulk-import'
import { Store } from '@/types'
import { toast } from 'sonner'

interface BulkUserImportFormProps {
  stores: Store[]
  onSuccess?: () => void
}

interface ImportResult {
  email: string
  status: 'success' | 'error' | 'skipped'
  message: string
}

export function BulkUserImportForm({ stores, onSuccess }: BulkUserImportFormProps) {
  const { csrfFetch } = useCSRF()
  const [file, setFile] = useState<File | null>(null)
  const [parsedUsers, setParsedUsers] = useState<BulkUserRow[]>([])
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([])
  const [defaultStoreId, setDefaultStoreId] = useState<string>('')
  const [isImporting, setIsImporting] = useState(false)
  const [results, setResults] = useState<ImportResult[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Reset state
    setResults(null)
    setParsedUsers([])
    setParseErrors([])

    // Check file type
    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file')
      return
    }

    // Check file size (max 1MB)
    if (selectedFile.size > 1024 * 1024) {
      toast.error('File size must be less than 1MB')
      return
    }

    setFile(selectedFile)

    // Parse the file
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const { users, errors } = parseUserCSV(content)
      setParsedUsers(users)
      setParseErrors(errors)
    }
    reader.readAsText(selectedFile)
  }, [])

  const handleDownloadTemplate = useCallback(() => {
    const template = generateCSVTemplate()
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'user-import-template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [])

  const handleImport = useCallback(async () => {
    if (parsedUsers.length === 0) {
      toast.error('No valid users to import')
      return
    }

    setIsImporting(true)
    setResults(null)

    try {
      const response = await csrfFetch('/api/users/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: parsedUsers.map(u => ({
            ...u,
            storeId: u.storeId || defaultStoreId || undefined,
          })),
          defaultStoreId: defaultStoreId || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Import failed')
      }

      setResults(data.data.results)
      toast.success(data.data.message)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }, [parsedUsers, defaultStoreId, onSuccess])

  const handleReset = useCallback(() => {
    setFile(null)
    setParsedUsers([])
    setParseErrors([])
    setResults(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk User Import</CardTitle>
        <CardDescription>
          Import multiple users at once from a CSV file. Users will receive invitation emails.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template Download */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border rounded-lg bg-muted/50">
          <div>
            <p className="font-medium">CSV Template</p>
            <p className="text-sm text-muted-foreground">
              Download the template to see the required format
            </p>
          </div>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Label htmlFor="csv-file">Upload CSV File</Label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <input
              ref={fileInputRef}
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-medium
                file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90
                cursor-pointer"
            />
            {file && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Default Store Selection */}
        {parsedUsers.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="default-store">Default Store (for users without store ID)</Label>
            <Select value={defaultStoreId} onValueChange={setDefaultStoreId}>
              <SelectTrigger id="default-store">
                <SelectValue placeholder="Select a default store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map(store => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This store will be used for Staff and Manager roles that don&apos;t have a store ID in the CSV.
            </p>
          </div>
        )}

        {/* Parse Errors */}
        {parseErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-2">
                {parseErrors.length} row{parseErrors.length > 1 ? 's' : ''} have errors:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {parseErrors.slice(0, 5).map((error, i) => (
                  <li key={i}>
                    Row {error.row}: {error.message}
                  </li>
                ))}
                {parseErrors.length > 5 && (
                  <li>...and {parseErrors.length - 5} more errors</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Parsed Users Preview */}
        {parsedUsers.length > 0 && (
          <div className="space-y-2">
            <Label>Preview ({parsedUsers.length} users)</Label>
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Role</th>
                    <th className="px-4 py-2 text-left">Store ID</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedUsers.slice(0, 10).map((user, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-2">{user.email}</td>
                      <td className="px-4 py-2">{user.role}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {user.storeId || '(default)'}
                      </td>
                    </tr>
                  ))}
                  {parsedUsers.length > 10 && (
                    <tr className="border-t">
                      <td colSpan={3} className="px-4 py-2 text-center text-muted-foreground">
                        ...and {parsedUsers.length - 10} more users
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import Results */}
        {results && (
          <div className="space-y-2">
            <Label>Import Results</Label>
            <div className="border rounded-lg overflow-hidden max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-2">{result.email}</td>
                      <td className="px-4 py-2">
                        {result.status === 'success' && (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle className="h-4 w-4" />
                            Success
                          </span>
                        )}
                        {result.status === 'skipped' && (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <AlertCircle className="h-4 w-4" />
                            Skipped
                          </span>
                        )}
                        {result.status === 'error' && (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <XCircle className="h-4 w-4" />
                            Error
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{result.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import Button */}
        {parsedUsers.length > 0 && !results && (
          <Button
            onClick={handleImport}
            disabled={isImporting || parseErrors.length > 0}
            className="w-full"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {parsedUsers.length} User{parsedUsers.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        )}

        {/* Import Another */}
        {results && (
          <Button variant="outline" onClick={handleReset} className="w-full">
            Import Another File
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
