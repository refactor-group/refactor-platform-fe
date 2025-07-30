"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ArrowUp, ArrowDown } from "lucide-react";
import { Id } from "@/types/general";
import { useAgreementList } from "@/lib/api/agreements";
import { Agreement, agreementToString } from "@/types/agreement";
import { DateTime } from "ts-luxon";
import { siteConfig } from "@/site.config";
import { cn } from "@/components/lib/utils";
import {
  getTableRowClasses,
  getTableHeaderRowClasses,
  getTableHeaderCellClasses,
  getTableHeaderCellClassesNonSortable,
} from "@/components/lib/utils/table-styling";

const AgreementsList: React.FC<{
  coachingSessionId: Id;
  userId: Id;
  locale: string | "us";
  onAgreementAdded: (value: string) => Promise<Agreement>;
  onAgreementEdited: (id: Id, value: string) => Promise<Agreement>;
  onAgreementDeleted: (id: Id) => Promise<Agreement>;
}> = ({
  coachingSessionId,
  onAgreementAdded,
  onAgreementEdited,
  onAgreementDeleted,
}) => {
  enum AgreementSortField {
    Body = "body",
    CreatedAt = "created_at",
    UpdatedAt = "updated_at",
  }

  const [newAgreement, setNewAgreement] = useState("");
  const { agreements, refresh } = useAgreementList(coachingSessionId);
  const [editingAgreementId, setEditingAgreementId] = useState<Id | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof Agreement>(
    AgreementSortField.CreatedAt
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Function to render the appropriate sort arrow
  const renderSortArrow = (column: keyof Agreement) => {
    if (sortColumn !== column) return null;

    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4 inline" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 inline" />
    );
  };

  // Function to clear the new agreement form
  const clearNewAgreementForm = () => {
    setNewAgreement("");
  };

  // Function to cancel editing an agreement
  const cancelEditAgreement = () => {
    setEditingAgreementId(null);
    clearNewAgreementForm();
  };

  const addAgreement = async () => {
    if (newAgreement.trim() === "") return;

    try {
      if (editingAgreementId) {
        // Update existing agreement
        const agreement = await onAgreementEdited(
          editingAgreementId,
          newAgreement
        );
        console.trace("Updated Agreement: " + agreementToString(agreement));
        setEditingAgreementId(null);
      } else {
        // Create new agreement
        const agreement = await onAgreementAdded(newAgreement);
        console.trace(
          "Newly created Agreement: " + agreementToString(agreement)
        );
      }

      // Refresh the agreements list from the hook
      refresh();

      // Clear input field
      clearNewAgreementForm();
    } catch (err) {
      console.error("Failed to save Agreement: " + err);
      throw err;
    }
  };

  const deleteAgreement = async (id: Id) => {
    if (id === "") return;

    try {
      // Delete agreement in backend
      const deletedAgreement = await onAgreementDeleted(id);

      console.trace(
        "Deleted Agreement (onAgreementDeleted): " +
          agreementToString(deletedAgreement)
      );

      // Refresh the agreements list from the hook
      refresh();
    } catch (err) {
      console.error("Failed to delete Agreement (id: " + id + "): " + err);
      throw err;
    }
  };

  const sortAgreements = (column: keyof Agreement) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedAgreements = [...agreements].sort((a, b) => {
    const aValue = a[sortColumn as keyof Agreement]!;
    const bValue = b[sortColumn as keyof Agreement]!;

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div>
      <div className="bg-inherit rounded-lg border border-gray-200 p-6">
        <div className="mb-4">
          <Table>
            <TableHeader>
              <TableRow className={getTableHeaderRowClasses()}>
                <TableHead
                  onClick={() => sortAgreements(AgreementSortField.Body)}
                  className={getTableHeaderCellClasses(true)}
                >
                  Agreement {renderSortArrow(AgreementSortField.Body)}
                </TableHead>
                <TableHead
                  onClick={() => sortAgreements(AgreementSortField.CreatedAt)}
                  className={cn(
                    getTableHeaderCellClasses(),
                    "hidden sm:table-cell"
                  )}
                >
                  Created {renderSortArrow(AgreementSortField.CreatedAt)}
                </TableHead>
                <TableHead
                  onClick={() => sortAgreements(AgreementSortField.UpdatedAt)}
                  className={cn(
                    getTableHeaderCellClasses(),
                    "hidden md:table-cell"
                  )}
                >
                  Updated {renderSortArrow(AgreementSortField.UpdatedAt)}
                </TableHead>
                <TableHead
                  className={cn(
                    "w-[100px]",
                    getTableHeaderRowClasses(),
                    getTableHeaderCellClassesNonSortable(false, true)
                  )}
                ></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAgreements.length === 0 ? (
                <TableRow className={getTableRowClasses(0)}>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    No Agreements
                  </TableCell>
                </TableRow>
              ) : (
                sortedAgreements.map((agreement, index) => (
                <TableRow
                  key={agreement.id}
                  className={getTableRowClasses(index)}
                >
                  <TableCell>{agreement.body}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {agreement.created_at
                      .setLocale(siteConfig.locale)
                      .toLocaleString(DateTime.DATETIME_MED)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {agreement.updated_at
                      .setLocale(siteConfig.locale)
                      .toLocaleString(DateTime.DATETIME_MED)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingAgreementId(agreement.id);
                            setNewAgreement(agreement.body ?? "");
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteAgreement(agreement.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {/* Create/Edit agreement form */}
        <div
          className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              editingAgreementId
                ? cancelEditAgreement()
                : clearNewAgreementForm();
            } else if (e.key === "Enter") {
              addAgreement();
            }
          }}
          tabIndex={-1}
        >
          <Input
            value={newAgreement}
            onChange={(e) => setNewAgreement(e.target.value)}
            placeholder={
              editingAgreementId ? "Edit agreement" : "Enter new agreement"
            }
            className="w-full sm:flex-grow"
          />
          <Button onClick={addAgreement} className="w-full sm:w-auto">
            {editingAgreementId ? "Update" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export { AgreementsList };
