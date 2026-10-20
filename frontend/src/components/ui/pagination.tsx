import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from './button'
import { generatePagination } from './pagination-utils'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  pageSize?: number
  totalItems?: number
  onPageSizeChange?: (pageSize: number) => void
  className?: string
  compact?: boolean
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  totalItems,
  onPageSizeChange,
  className,
  compact = false,
}: PaginationProps) {
  if (totalPages <= 1 && !totalItems) return null

  if (compact) {
    const fromItem =
      totalItems !== undefined && pageSize
        ? Math.min((currentPage - 1) * pageSize + 1, totalItems)
        : (currentPage - 1) * (pageSize ?? 10) + 1
    const toItem =
      totalItems !== undefined && pageSize
        ? Math.min(currentPage * pageSize, totalItems)
        : currentPage * (pageSize ?? 10)

    return (
      <div
        className={cn(
          'flex items-center justify-between gap-2 py-2 text-xs text-slate-500 dark:text-slate-400',
          className
        )}
      >
        <div className="whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
          {totalItems !== undefined ? (
            <span>
              {fromItem}–{toItem} of {totalItems}
            </span>
          ) : (
            <span>Page {currentPage} of {totalPages}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-slate-400">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-7 w-7"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="h-7 w-7"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  const pages = generatePagination(currentPage, totalPages)

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 py-3 text-sm text-slate-600 dark:text-slate-400',
        className
      )}
    >
      {/* Total Items Info */}
      <div className="flex items-center gap-4">
        {totalItems !== undefined && (
          <span className="text-xs sm:text-sm">
            Showing{' '}
            <span className="font-medium text-slate-900 dark:text-slate-200">
              {pageSize ? Math.min((currentPage - 1) * pageSize + 1, totalItems) : 1}
            </span>{' '}
            to{' '}
            <span className="font-medium text-slate-900 dark:text-slate-200">
              {pageSize ? Math.min(currentPage * pageSize, totalItems) : totalItems}
            </span>{' '}
            of <span className="font-medium text-slate-900 dark:text-slate-200">{totalItems}</span> results
          </span>
        )}

        {pageSize && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 py-1 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center space-x-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="h-8 w-8"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pages.map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} className="px-2 py-1 text-slate-400">
                ...
              </span>
            )
          }

          const pageNum = page as number
          const isCurrent = pageNum === currentPage

          return (
            <Button
              key={pageNum}
              variant={isCurrent ? 'primary' : 'outline'}
              size="sm"
              onClick={() => onPageChange(pageNum)}
              className="h-8 min-w-[32px] px-2.5"
            >
              {pageNum}
            </Button>
          )
        })}

        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages || totalPages === 0}
          className="h-8 w-8"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
