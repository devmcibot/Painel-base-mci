"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

// Atualiza o nome do médico com validação manual
export async function updateProfile(userId: number, formData: FormData) {
  const name = formData.get("name");
  const cpf = (String(formData.get("cpf") ?? "").trim() || null) as string | null;
  const endereco = (String(formData.get("endereco") ?? "").trim() || null) as string | null;
   if (!name || name.length < 3) {
    return { error: "O nome é obrigatório e precisa ter no mínimo 3 caracteres." };
  }
  
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { name, cpf, endereco },
    });
    revalidatePath("/medico/perfil");
    return { success: true };
  } catch (e: any) {
    if (e?.code === "P2002") return { error: "CPF já está em uso." };
    console.error(e);
    return { error: "Não foi possível atualizar o perfil." };
  }
}

// ========= Troca de senha (User.hashedPwd) =========
export async function changePassword(userId: number, formData: FormData) {
  const oldPassword = String(formData.get("oldPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!newPassword || newPassword.length < 6) {
    return { error: "Nova senha precisa ter pelo menos 6 caracteres." };
  }

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

  // Validação manual em vez de Zod
  if (!name || typeof name !== "string" || name.trim().length < 3) {
    return {
      error: "O nome é obrigatório e precisa ter no mínimo 3 caracteres.",
    };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() }, // Usamos .trim() para remover espaços em branco
    });
    revalidatePath("/perfil"); // Atualiza o cache da página
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Não foi possível atualizar o perfil." };
  }
}

// Atualiza os horários de atendimento (sem alterações aqui)
export async function updateHorarios(
  medicoId: number,
  horarios: { weekday: number; startMin: number; endMin: number }[]
) {
  try {
    await prisma.$transaction([
      prisma.medicoHorario.deleteMany({
        where: { medicoId: medicoId },
      }),
      prisma.medicoHorario.createMany({
        data: horarios.map((h) => ({ ...h, medicoId })),
      }),
    ]);
    revalidatePath("/perfil");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Não foi possível salvar os horários." };
  }
}

// Adiciona uma nova ausência (sem alterações aqui)
export async function addAusencia(
  medicoId: number,
  data: { inicio: Date; fim: Date; motivo?: string }
) {
  // Validação simples para datas
  if (!data.inicio || !data.fim || data.inicio >= data.fim) {
    return { error: "A data de início deve ser anterior à data de fim." };
  }

  try {
    await prisma.medicoAusencia.create({
      data: {
        medicoId,
        inicio: data.inicio,
        fim: data.fim,
        motivo: data.motivo,
      },
    });
    revalidatePath("/perfil");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Não foi possível adicionar a ausência." };
  }
}

// Remove uma ausência (sem alterações aqui)
export async function deleteAusencia(ausenciaId: number) {
  try {
    await prisma.medicoAusencia.delete({
      where: { id: ausenciaId },
    });
    revalidatePath("/perfil");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Não foi possível remover a ausência." };
  }
}
