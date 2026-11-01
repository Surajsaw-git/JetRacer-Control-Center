import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  requiredTypedText?: string // If supplied, user must type this exact string to enable confirm
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  requiredTypedText,
  onConfirm,
}: ConfirmDialogProps) {
  const [typedInput, setTypedInput] = useState('')

  const isTypedMatch = !requiredTypedText || typedInput.trim() === requiredTypedText.trim()

  const handleConfirm = () => {
    if (!isTypedMatch) return
    onConfirm()
    onOpenChange(false)
    setTypedInput('')
  }

  const handleCancel = () => {
    onOpenChange(false)
    setTypedInput('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{description}</DialogDescription>
        </DialogHeader>

        {requiredTypedText && (
          <div className="space-y-2 py-2">
            <Label htmlFor="typed-confirmation" className="text-xs text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">{requiredTypedText}</span>{' '}
              to confirm:
            </Label>
            <Input
              id="typed-confirmation"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder={requiredTypedText}
              className="font-mono min-h-[44px]"
              autoComplete="off"
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleCancel} className="min-h-[44px]">
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant}
            disabled={!isTypedMatch}
            onClick={handleConfirm}
            className="min-h-[44px]"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ConfirmDialog
