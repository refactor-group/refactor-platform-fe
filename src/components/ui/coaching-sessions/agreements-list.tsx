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
import { MoreHorizontal, ArrowUpDown } from "lucide-react";
import { Id } from "@/types/general";
import { useAgreementList } from "@/lib/api/agreements";
import { Agreement, agreementToString } from "@/types/agreement";
import { DateTime } from "ts-luxon";
import { siteConfig } from "@/site.config";

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
  const { agreements, isLoading, isError, refresh } =
    useAgreementList(coachingSessionId);
  const [editingId, setEditingId] = useState<Id | null>(null);
  const [editBody, setEditBody] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof Agreement>(
    AgreementSortField.CreatedAt
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const addAgreement = async () => {
    if (newAgreement.trim() === "") return;

    try {
      // Call the external handler to create the agreement
      const agreement = await onAgreementAdded(newAgreement);

      console.trace(
        "Newly created Agreement (onAgreementAdded): " +
          agreementToString(agreement)
      );

      // Refresh the agreements list from the hook
      refresh();

      // Clear input field
      setNewAgreement("");
    } catch (err) {
      console.error("Failed to create new Agreement: " + err);
      throw err;
    }
  };

  const updateAgreement = async (id: Id, newBody: string) => {
    const body = newBody.trim();
    if (body === "") return;

    try {
      // Update agreement in backend
      const updatedAgreement = await onAgreementEdited(id, body);

      console.trace(
        "Updated Agreement (onAgreementUpdated): " +
          agreementToString(updatedAgreement)
      );

      // Refresh the agreements list from the hook
      refresh();

      // Reset editing UI state
      setEditingId(null);
      setEditBody("");
    } catch (err) {
      console.error("Failed to update Agreement (id: " + id + "): ", err);
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
              <TableRow>
                <TableHead
                  onClick={() => sortAgreements(AgreementSortField.Body)}
                  className={`cursor-pointer ${
                    sortColumn === AgreementSortField.Body
                      ? "underline"
                      : "no-underline"
                  }`}
                >
                  Agreement <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                </TableHead>
                <TableHead
                  onClick={() => sortAgreements(AgreementSortField.CreatedAt)}
                  className={`cursor-pointer hidden sm:table-cell ${
                    sortColumn === AgreementSortField.CreatedAt
                      ? "underline"
                      : "no-underline"
                  }`}
                >
                  Created
                  <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                </TableHead>
                <TableHead
                  className={`cursor-pointer hidden md:table-cell ${
                    sortColumn === AgreementSortField.UpdatedAt
                      ? "underline"
                      : "no-underline"
                  }`}
                  onClick={() => sortAgreements(AgreementSortField.UpdatedAt)}
                >
                  Updated <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                </TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAgreements.map((agreement) => (
                <TableRow key={agreement.id}>
                  <TableCell>
                    {editingId === agreement.id ? (
                      <div className="flex items-center space-x-2">
                        <Input
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          onKeyPress={(e) =>
                            e.key === "Enter" &&
                            updateAgreement(agreement.id, editBody)
                          }
                          className="flex-grow"
                        />
                        <Button
                          size="sm"
                          onClick={() =>
                            updateAgreement(agreement.id, editBody)
                          }
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      agreement.body
                    )}
                  </TableCell>
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
                            setEditingId(agreement.id);
                            setEditBody(agreement.body ?? "");
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
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center space-x-2">
          <Input
            value={newAgreement}
            onChange={(e) => setNewAgreement(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addAgreement()}
            placeholder="Enter new agreement"
            className="flex-grow"
          />
          <Button onClick={addAgreement}>Save</Button>
        </div>
      </div>
    </div>
  );
};

export { AgreementsList };
