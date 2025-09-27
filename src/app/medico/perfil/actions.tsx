"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ========== Atualizar nome + e-mail (User) e CRM (Medico)
export async function updateProfile(userId: number, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const crm = String(formData.get("crm") ?? "").trim() || null;
  const medicoId = Number(formData.get("medicoId"));

  if (!name || name.length < 3) return { error: "Informe um nome válido." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Informe um e-mail válido." };
  if (!medicoId || Number.isNaN(medicoId))
    return { error: "Médico inválido." };

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { name, email } }),
      prisma.medico.update({ where: { id: medicoId }, data: { crm } }),
    ]);
    revalidatePath("/medico/perfil");
    return { success: true };
  } catch (e: any) {
    if (e?.code === "P2002") return { error: "E-mail já está em uso." };
    console.error(e);
    return { error: "Não foi possível atualizar o perfil." };
  }
}

// ========== Trocar senha
export async function changePassword(userId: number, formData: FormData) {
  const oldPassword = String(formData.get("oldPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!newPassword || newPassword.length < 6)
    return { error: "A nova senha deve ter pelo menos 6 caracteres." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hashedPwd: true },
  });
  if (!user) return { error: "Usuário não encontrado." };

  const ok = await bcrypt.compare(oldPassword, user.hashedPwd);
  if (!ok) return { error: "Senha atual inválida." };

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { hashedPwd: hash } });

  revalidatePath("/medico/perfil");
  return { success: true };
}

// ========== Horários (igual, só revalidatePath)
export async function updateHorarios(
  medicoId: number,
  horarios: { weekday: number; startMin: number; endMin: number }[]
) {
  try {
    await prisma.$transaction([
      prisma.medicoHorario.deleteMany({ where: { medicoId } }),
      prisma.medicoHorario.createMany({
        data: horarios.map((h) => ({ ...h, medicoId })),
      }),
    ]);
    revalidatePath("/medico/perfil");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Não foi possível salvar os horários." };
  }
}

// ========== Ausências (igual, só revalidatePath)
export async function addAusencia(
  medicoId: number,
  data: { inicio: Date; fim: Date; motivo?: string }
) {
  if (!data.inicio || !data.fim || data.inicio >= data.fim)
    return { error: "A data de início deve ser anterior à data de fim." };

  try {
    await prisma.medicoAusencia.create({
      data: { medicoId, inicio: data.inicio, fim: data.fim, motivo: data.motivo },
    });
    revalidatePath("/medico/perfil");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Não foi possível adicionar a ausência." };
  }
}

export async function deleteAusencia(ausenciaId: number) {
  try {
    await prisma.medicoAusencia.delete({ where: { id: ausenciaId } });
    revalidatePath("/medico/perfil");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Não foi possível remover a ausência." };
  }
}
