-- Migration: 0005_role_client_interne
-- Nouveau rôle « Client interne » : une personne de l'entreprise qui note les agents
-- qu'on lui affecte sur les critères « Clients internes », sans être elle-même classée.
-- Idempotente.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CLIENT_INTERNE';
