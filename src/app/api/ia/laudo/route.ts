import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// IMPORTANTE: Força Node, porque docx precisa
export const runtime = "nodejs";

// IMPORTA A LIB PARA GERAR WORD
import { Document, Packer, Paragraph } from "docx";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { path, pacienteNome, cpfLast4, pacienteId } = await req.json();

    if (!path) {
      return NextResponse.json(
        { error: "Caminho do arquivo não informado." },
        { status: 400 }
      );
    }

    // ================================
    // 1) BAIXAR O ARQUIVO TXT ORIGINAL
    // ================================
    const { data, error } = await supabaseAdmin.storage
      .from(process.env.SUPABASE_BUCKET || "mci-files")
      .download(path);

    if (error || !data) {
      console.error("Erro ao baixar arquivo:", error);
      return NextResponse.json(
        { error: "Não foi possível baixar o arquivo de anamnese." },
        { status: 500 }
      );
    }

    const anamneseTexto = await data.text();

    // ================================
    // 2) MONTAR PROMPTS
    // ================================
    const systemPrompt = `
Você é um Médico Clínico Geral experiente. Sua tarefa é transformar uma ANAMNESE (texto bruto) em um LAUDO MÉDICO RESUMIDO, claro, objetivo e profissional.

Regras:
- NÃO invente nada. Se faltar informação, escreva "Não informado".
- Estrutura do laudo:

**LAUDO MÉDICO RESUMIDO**

1. Identificação do paciente
2. Queixa principal (QP)
3. História da doença atual (HDA)
4. Antecedentes pessoais e familiares relevantes
5. Hábitos de vida
6. Exame físico (se houver)
7. Hipóteses diagnósticas (em bullet points)
8. Condutas sugeridas (exames, encaminhamentos)
9. Orientações ao paciente

- Utilize português do Brasil.
- Não prescreva medicamentos específicos; cite apenas classes (ex.: analgésicos comuns).
`.trim();

    const userPrompt = `
Identificação do paciente:
- Nome: ${pacienteNome || "Não informado"}
- ID interno: ${pacienteId || "Não informado"}
- CPF (4 últimos dígitos): ${cpfLast4 || "Não informado"}

Transcrição da anamnese:
"""
${anamneseTexto}
"""
`.trim();

    // ================================
    // 3) GERAR TEXTO VIA OPENAI
    // ================================
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const laudoTexto =
      completion.choices[0].message.content ||
      "Não foi possível gerar laudo.";

    // ================================
    // 4) GERAR ARQUIVO WORD (.docx)
    // ================================
    const linhas = laudoTexto.split("\n").map((linha) => new Paragraph(linha));

    const doc = new Document({
      sections: [
        {
          children: linhas,
        },
      ],
    });

    // Gera um buffer .docx
    const buffer = await Packer.toBuffer(doc);

    // ================================
    // 5) DEFINIR NOME E PATH DO ARQUIVO
    // ================================
    const pathParts = path.split("/");
    const folder = pathParts.slice(0, -1).join("/");

    const laudoFileName = `laudo_${Date.now()}.docx`;
    const laudoPath = `${folder}/${laudoFileName}`;

    // ================================
    // 6) SALVAR NO SUPABASE (DOCX)
    // ================================
    const { error: uploadError } = await supabaseAdmin.storage
      .from(process.env.SUPABASE_BUCKET || "mci-files")
      .upload(laudoPath, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      console.error("Erro ao salvar laudo:", uploadError);
      return NextResponse.json(
        { error: "Laudo gerado, mas falhou ao salvar o arquivo." },
        { status: 500 }
      );
    }

    // SUCCESS
    return NextResponse.json(
      {
        ok: true,
        laudoPath,
        laudoTexto,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Erro geral na rota de laudo:", err);
    return NextResponse.json(
      { error: "Erro interno ao gerar laudo." },
      { status: 500 }
    );
  }
}
