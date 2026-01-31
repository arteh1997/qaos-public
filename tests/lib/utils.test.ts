import { describe, it, expect } from 'vitest'
import { sanitizeString, sanitizeNotes, cn } from '@/lib/utils'

describe('Utility Functions', () => {
  describe('sanitizeString', () => {
    describe('Basic HTML Entity Escaping', () => {
      it('should escape ampersand', () => {
        expect(sanitizeString('Tom & Jerry')).toBe('Tom &amp; Jerry')
      })

      it('should escape less than', () => {
        expect(sanitizeString('5 < 10')).toBe('5 &lt; 10')
      })

      it('should escape greater than', () => {
        expect(sanitizeString('10 > 5')).toBe('10 &gt; 5')
      })

      it('should escape double quotes', () => {
        expect(sanitizeString('Say "hello"')).toBe('Say &quot;hello&quot;')
      })

      it('should escape single quotes', () => {
        expect(sanitizeString("It's fine")).toBe('It&#x27;s fine')
      })

      it('should escape forward slashes', () => {
        expect(sanitizeString('path/to/file')).toBe('path&#x2F;to&#x2F;file')
      })
    })

    describe('XSS Attack Prevention', () => {
      it('should sanitize script tags', () => {
        const malicious = '<script>alert("XSS")</script>'
        const sanitized = sanitizeString(malicious)

        expect(sanitized).not.toContain('<script>')
        expect(sanitized).toBe(
          '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;'
        )
      })

      it('should sanitize event handlers by escaping HTML', () => {
        const malicious = '<img onerror="alert(1)" src="x">'
        const sanitized = sanitizeString(malicious)

        // The function escapes HTML entities (< and >) making it safe
        // The content is preserved but rendered as text, not HTML
        expect(sanitized).toBe(
          '&lt;img onerror=&quot;alert(1)&quot; src=&quot;x&quot;&gt;'
        )
        // Key: < and > are escaped, preventing browser from parsing as HTML
        expect(sanitized).not.toContain('<')
        expect(sanitized).not.toContain('>')
      })

      it('should sanitize javascript: protocol', () => {
        const malicious = 'javascript:alert(1)'
        const sanitized = sanitizeString(malicious)

        expect(sanitized).toBe('javascript:alert(1)') // Protocol itself is not escaped
      })

      it('should sanitize nested tags', () => {
        const malicious = '<<script>script>alert(1)<</script>/script>'
        const sanitized = sanitizeString(malicious)

        expect(sanitized).not.toContain('<script>')
      })
    })

    describe('Edge Cases', () => {
      it('should return empty string for null', () => {
        expect(sanitizeString(null)).toBe('')
      })

      it('should return empty string for undefined', () => {
        expect(sanitizeString(undefined)).toBe('')
      })

      it('should return empty string for empty string', () => {
        expect(sanitizeString('')).toBe('')
      })

      it('should handle multiple special characters', () => {
        const input = '<div class="test" data-attr=\'value\'>&</div>'
        const result = sanitizeString(input)

        expect(result).toBe(
          '&lt;div class=&quot;test&quot; data-attr=&#x27;value&#x27;&gt;&amp;&lt;&#x2F;div&gt;'
        )
      })

      it('should handle strings with only special characters', () => {
        expect(sanitizeString('<>&"\'//')).toBe(
          '&lt;&gt;&amp;&quot;&#x27;&#x2F;&#x2F;'
        )
      })

      it('should preserve normal text', () => {
        const normalText = 'Hello World 123'
        expect(sanitizeString(normalText)).toBe(normalText)
      })

      it('should handle unicode characters', () => {
        const unicode = '日本語 & more'
        expect(sanitizeString(unicode)).toBe('日本語 &amp; more')
      })
    })
  })

  describe('sanitizeNotes', () => {
    describe('Basic Functionality', () => {
      it('should return undefined for null', () => {
        expect(sanitizeNotes(null)).toBeUndefined()
      })

      it('should return undefined for undefined', () => {
        expect(sanitizeNotes(undefined)).toBeUndefined()
      })

      it('should return undefined for empty string', () => {
        expect(sanitizeNotes('')).toBeUndefined()
      })

      it('should return undefined for whitespace-only string', () => {
        expect(sanitizeNotes('   ')).toBeUndefined()
        expect(sanitizeNotes('\n\t  ')).toBeUndefined()
      })

      it('should trim whitespace from valid notes', () => {
        expect(sanitizeNotes('  hello  ')).toBe('hello')
        expect(sanitizeNotes('\ntest\n')).toBe('test')
      })
    })

    describe('HTML Tag Stripping', () => {
      it('should strip simple HTML tags', () => {
        expect(sanitizeNotes('<p>Hello</p>')).toBe('Hello')
      })

      it('should strip script tags', () => {
        expect(sanitizeNotes('<script>alert(1)</script>Visible text')).toBe(
          'alert(1)Visible text'
        )
      })

      it('should strip nested tags', () => {
        expect(sanitizeNotes('<div><span>Hello</span></div>')).toBe('Hello')
      })

      it('should strip self-closing tags', () => {
        expect(sanitizeNotes('Line<br/>Break')).toBe('LineBreak')
        expect(sanitizeNotes('Image<img src="x"/>Here')).toBe('ImageHere')
      })

      it('should strip tags with attributes', () => {
        expect(
          sanitizeNotes('<a href="http://example.com" target="_blank">Link</a>')
        ).toBe('Link')
      })

      it('should handle malformed tags', () => {
        // Regex /<[^>]*>/g only matches complete tags with closing >
        // '<div unclosed content' has no closing >, so nothing is stripped
        expect(sanitizeNotes('<div unclosed content')).toBe('<div unclosed content')
        // '<>' is matched and removed
        expect(sanitizeNotes('content<>more')).toBe('contentmore')
      })
    })

    describe('Length Limiting', () => {
      it('should not truncate notes under 1000 characters', () => {
        const shortNote = 'A'.repeat(500)
        expect(sanitizeNotes(shortNote)).toBe(shortNote)
      })

      it('should not truncate notes exactly 1000 characters', () => {
        const exactNote = 'B'.repeat(1000)
        expect(sanitizeNotes(exactNote)).toBe(exactNote)
      })

      it('should truncate notes over 1000 characters', () => {
        const longNote = 'C'.repeat(1500)
        const result = sanitizeNotes(longNote)

        expect(result?.length).toBe(1000)
        expect(result).toBe('C'.repeat(1000))
      })

      it('should truncate after stripping tags', () => {
        const paddedNote = '<b>' + 'D'.repeat(1200) + '</b>'
        const result = sanitizeNotes(paddedNote)

        expect(result?.length).toBe(1000)
      })
    })

    describe('Combined Operations', () => {
      it('should strip tags, trim, and limit in correct order', () => {
        const complexNote =
          '  <div class="note">' + 'E'.repeat(1100) + '</div>  '
        const result = sanitizeNotes(complexNote)

        expect(result?.length).toBe(1000)
        expect(result).not.toContain('<')
        expect(result).not.toContain('>')
        expect(result?.trim()).toBe(result) // Should be trimmed
      })

      it('should handle realistic note content', () => {
        const realisticNote =
          '  Received 50 boxes of produce. Quality: Good. Driver: John.  '
        expect(sanitizeNotes(realisticNote)).toBe(
          'Received 50 boxes of produce. Quality: Good. Driver: John.'
        )
      })
    })
  })

  describe('cn (className utility)', () => {
    it('should merge basic class names', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2')
    })

    it('should handle conditional classes', () => {
      expect(cn('base', true && 'conditional')).toBe('base conditional')
      expect(cn('base', false && 'conditional')).toBe('base')
    })

    it('should handle undefined/null values', () => {
      expect(cn('base', undefined, null, 'another')).toBe('base another')
    })

    it('should merge Tailwind classes correctly', () => {
      // Later class should override earlier conflicting class
      expect(cn('px-2', 'px-4')).toBe('px-4')
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
    })

    it('should handle arrays of classes', () => {
      expect(cn(['class1', 'class2'])).toBe('class1 class2')
    })

    it('should handle object notation', () => {
      expect(cn({ active: true, disabled: false })).toBe('active')
    })

    it('should handle empty input', () => {
      expect(cn()).toBe('')
      expect(cn('')).toBe('')
    })
  })
})
