"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ========== PERFIL (nome) – mantém sua lógica, só corrige o caminho ==========
export async function updateProfile(userId: number, formData: FormData) {
  const name = formData.get("name");
  if (!name || typeof name !== "string" || name.trim().length < 3) {
    return { error: "O nome é obrigatório e precisa ter no mínimo 3 caracteres." };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
    });
    revalidatePath("/medico/perfil");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Não foi possível atualizar o perfil." };
  }
}

// ========== NOVA: trocar senha ==========
export async function changePassword(userId: number, formData: FormData) {
  const oldPassword = String(formData.get("oldPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!newPassword || newPassword.length < 6) {
    return { error: "A nova senha deve ter pelo menos 6 caracteres." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hashedPwd: true },
  });
  if (!user) return { error: "Usuário não encontrado." };

  const ok = await bcrypt.compare(oldPassword, user.hashedPwd);
  if (!ok) return { error: "Senha atual inválida." };

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { hashedPwd: hash },
  });

  revalidatePath("/medico/perfil");
  return { success: true };
}

// ========== HORÁRIOS (igual, só corrige revalidatePath) ==========
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

// ========== AUSÊNCIAS (iguais, só corrige revalidatePath) ==========
export async function addAusencia(
  medicoId: number,
  data: { inicio: Date; fim: Date; motivo?: string }
) {
  if (!data.inicio || !data.fim || data.inicio >= data.fim) {
    return { error: "A data de início deve ser anterior à data de fim." };
  }

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
