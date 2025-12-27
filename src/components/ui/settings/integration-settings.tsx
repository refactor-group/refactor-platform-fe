"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Id } from "@/types/general";
import { UserIntegration } from "@/types/user-integration";
import { useUserIntegrationMutation } from "@/lib/api/user-integrations";
import { siteConfig } from "@/site.config";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface IntegrationSettingsProps {
  userId: Id;
  integration: UserIntegration;
  onRefresh: () => void;
}

export function IntegrationSettings({
  userId,
  integration,
  onRefresh,
}: IntegrationSettingsProps) {
  const [recallApiKey, setRecallApiKey] = useState("");
  const [assemblyApiKey, setAssemblyApiKey] = useState("");
  const [showRecallKey, setShowRecallKey] = useState(false);
  const [showAssemblyKey, setShowAssemblyKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [isUpdatingAiSettings, setIsUpdatingAiSettings] = useState(false);

  const {
    updateRecallAi,
    updateAssemblyAi,
    verifyRecallAi,
    verifyAssemblyAi,
    disconnectGoogle,
    updateAiSettings,
  } = useUserIntegrationMutation(userId);

  const handleSaveRecallAi = async () => {
    if (!recallApiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    setIsSaving("recall");
    try {
      await updateRecallAi({ api_key: recallApiKey });
      toast.success("Recall.ai API key saved successfully");
      setRecallApiKey("");
      onRefresh();
    } catch (error) {
      toast.error("Failed to save Recall.ai API key");
      console.error("Error saving Recall.ai key:", error);
    } finally {
      setIsSaving(null);
    }
  };

  const handleSaveAssemblyAi = async () => {
    if (!assemblyApiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    setIsSaving("assembly");
    try {
      await updateAssemblyAi({ api_key: assemblyApiKey });
      toast.success("AssemblyAI API key saved successfully");
      setAssemblyApiKey("");
      onRefresh();
    } catch (error) {
      toast.error("Failed to save AssemblyAI API key");
      console.error("Error saving AssemblyAI key:", error);
    } finally {
      setIsSaving(null);
    }
  };

  const handleVerifyRecallAi = async () => {
    setIsVerifying("recall");
    try {
      const result = await verifyRecallAi();
      if (result.success) {
        toast.success("Recall.ai API key verified successfully");
        onRefresh();
      } else {
        toast.error(result.message || "Verification failed");
      }
    } catch (error) {
      toast.error("Failed to verify Recall.ai API key");
      console.error("Error verifying Recall.ai key:", error);
    } finally {
      setIsVerifying(null);
    }
  };

  const handleVerifyAssemblyAi = async () => {
    setIsVerifying("assembly");
    try {
      const result = await verifyAssemblyAi();
      if (result.success) {
        toast.success("AssemblyAI API key verified successfully");
        onRefresh();
      } else {
        toast.error(result.message || "Verification failed");
      }
    } catch (error) {
      toast.error("Failed to verify AssemblyAI API key");
      console.error("Error verifying AssemblyAI key:", error);
    } finally {
      setIsVerifying(null);
    }
  };

  const handleConnectGoogle = () => {
    // Redirect to Google OAuth flow with user_id parameter
    window.location.href = `${siteConfig.env.backendServiceURL}/oauth/google/authorize?user_id=${userId}`;
  };

  const handleDisconnectGoogle = async () => {
    try {
      await disconnectGoogle();
      toast.success("Google account disconnected");
      onRefresh();
    } catch (error) {
      toast.error("Failed to disconnect Google account");
      console.error("Error disconnecting Google:", error);
    }
  };

  const handleAutoApproveChange = async (checked: boolean) => {
    setIsUpdatingAiSettings(true);
    try {
      await updateAiSettings(checked);
      toast.success(
        checked
          ? "AI suggestions will be auto-approved"
          : "AI suggestions will require review"
      );
      onRefresh();
    } catch (error) {
      toast.error("Failed to update AI settings");
      console.error("Error updating AI settings:", error);
    } finally {
      setIsUpdatingAiSettings(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Google Integration */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Google Account</h3>
            <p className="text-sm text-muted-foreground">
              Connect your Google account to create Google Meet links
            </p>
          </div>
          <StatusBadge connected={integration.google_connected} />
        </div>

        {integration.google_connected ? (
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="font-medium">{integration.google_email}</p>
              <p className="text-sm text-muted-foreground">Connected</p>
            </div>
            <Button variant="outline" onClick={handleDisconnectGoogle}>
              Disconnect
            </Button>
          </div>
        ) : (
          <Button onClick={handleConnectGoogle}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Connect Google Account
          </Button>
        )}
      </div>

      {/* Recall.ai Integration */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Recall.ai</h3>
            <p className="text-sm text-muted-foreground">
              Meeting recording bot service for Google Meet
            </p>
          </div>
          <StatusBadge
            connected={integration.recall_ai_configured}
            verifiedAt={integration.recall_ai_verified_at}
          />
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="recall-api-key">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="recall-api-key"
                  type={showRecallKey ? "text" : "password"}
                  placeholder={
                    integration.recall_ai_configured
                      ? "••••••••••••••••"
                      : "Enter your Recall.ai API key"
                  }
                  value={recallApiKey}
                  onChange={(e) => setRecallApiKey(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowRecallKey(!showRecallKey)}
                >
                  {showRecallKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                onClick={handleSaveRecallAi}
                disabled={isSaving === "recall" || !recallApiKey.trim()}
              >
                {isSaving === "recall" ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {integration.recall_ai_configured && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifyRecallAi}
              disabled={isVerifying === "recall"}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isVerifying === "recall" ? "animate-spin" : ""}`}
              />
              {isVerifying === "recall" ? "Verifying..." : "Verify Connection"}
            </Button>
          )}
        </div>
      </div>

      {/* AssemblyAI Integration */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">AssemblyAI</h3>
            <p className="text-sm text-muted-foreground">
              AI transcription service for meeting recordings
            </p>
          </div>
          <StatusBadge
            connected={integration.assembly_ai_configured}
            verifiedAt={integration.assembly_ai_verified_at}
          />
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="assembly-api-key">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="assembly-api-key"
                  type={showAssemblyKey ? "text" : "password"}
                  placeholder={
                    integration.assembly_ai_configured
                      ? "••••••••••••••••"
                      : "Enter your AssemblyAI API key"
                  }
                  value={assemblyApiKey}
                  onChange={(e) => setAssemblyApiKey(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowAssemblyKey(!showAssemblyKey)}
                >
                  {showAssemblyKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                onClick={handleSaveAssemblyAi}
                disabled={isSaving === "assembly" || !assemblyApiKey.trim()}
              >
                {isSaving === "assembly" ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {integration.assembly_ai_configured && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifyAssemblyAi}
              disabled={isVerifying === "assembly"}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isVerifying === "assembly" ? "animate-spin" : ""}`}
              />
              {isVerifying === "assembly" ? "Verifying..." : "Verify Connection"}
            </Button>
          )}
        </div>
      </div>

      {/* AI Settings */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Settings
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure how AI-generated suggestions are handled
          </p>
        </div>

        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="space-y-0.5">
            <Label
              htmlFor="auto-approve"
              className="text-base font-medium cursor-pointer"
            >
              Auto-approve AI suggestions
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically create Actions and Agreements from meeting transcripts
              without manual review
            </p>
          </div>
          <Switch
            id="auto-approve"
            checked={integration.auto_approve_ai_suggestions}
            onCheckedChange={handleAutoApproveChange}
            disabled={isUpdatingAiSettings}
          />
        </div>

        {integration.auto_approve_ai_suggestions && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            ⚠️ AI suggestions will be automatically added to your sessions. Review
            your Actions and Agreements regularly to ensure accuracy.
          </p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  connected,
  verifiedAt,
}: {
  connected: boolean;
  verifiedAt?: string | null;
}) {
  if (connected) {
    return (
      <Badge variant="default" className="bg-green-600 hover:bg-green-700">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Connected
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      <XCircle className="h-3 w-3 mr-1" />
      Not Connected
    </Badge>
  );
}
