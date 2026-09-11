import { TransactionType } from '../types/common.js';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryDTO {
  name: string;
  type: TransactionType;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateCategoryDTO {
  name?: string;
  type?: TransactionType;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
}
