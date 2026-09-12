import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertOctagon, ShieldAlert, RefreshCw } from 'lucide-react';
import { releasesService } from '@/services';
import type { RollbackResponse } from '@/types';

interface RollbackConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  releaseId: string;
  releaseVersion: string;
  defaultReason?: string;
  onSuccess?: (res: RollbackResponse) => void;
}

export const RollbackConfirmationModal: React.FC<RollbackConfirmationModalProps> = ({
  isOpen,
  onClose,
  releaseId,
  releaseVersion,
  defaultReason,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState(
    defaultReason || 'Canary telemetry observed critical latency regression and error rate spikes exceeding safe limits.',
  );
  const [targetVersion, setTargetVersion] = useState('previous-stable');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rollbackMutation = useMutation({
    mutationFn: () =>
      releasesService.rollbackRelease(releaseId, {
        reason,
        targetStableVersion: targetVersion,
        webhookUrl: webhookUrl.trim() || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['releases', releaseId] });
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      queryClient.invalidateQueries({ queryKey: ['releases', releaseId, 'telemetry'] });
      if (onSuccess) onSuccess(data);
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to dispatch rollback';
      setErrorMsg(msg);
    },
  });

  const handleConfirm = () => {
    setErrorMsg(null);
    rollbackMutation.mutate();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Trigger Emergency Deployment Rollback
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              Revert production traffic for release <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{releaseVersion}</span>
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose} disabled={rollbackMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={rollbackMutation.isPending || !reason.trim()}
            className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium"
          >
            {rollbackMutation.isPending ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Dispatching Rollback...</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Confirm Immediate Rollback</span>
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1 text-xs">
        {/* Warning Banner */}
        <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200 flex items-start gap-2.5">
          <AlertOctagon className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div>
            <p className="font-semibold">Destructive Action Notice</p>
            <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
              Dispatching a rollback will notify your deployment orchestrator (GitHub / Kubernetes webhook), fire incident alerts to team channels, and mark this release as rolled back in the audit trail.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-rose-300 bg-rose-100 p-2.5 text-rose-800 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Rollback Reason Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Rollback Justification / Reason:
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
            placeholder="Explain the failure or metric threshold breach..."
          />
        </div>

        {/* Target Version */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Target Previous Stable Version:
          </label>
          <Input
            value={targetVersion}
            onChange={(e) => setTargetVersion(e.target.value)}
            className="h-8 text-xs font-mono"
            placeholder="e.g. v1.9.4 or previous-stable"
          />
        </div>

        {/* Optional Webhook Override */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>CI/CD Rollback Webhook URL (Optional):</span>
            <span className="text-[10px] text-slate-400 font-normal">Overrides org default</span>
          </label>
          <Input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="h-8 text-xs font-mono"
            placeholder="https://deployer.internal/webhooks/rollback"
          />
        </div>
      </div>
    </Modal>
  );
};
