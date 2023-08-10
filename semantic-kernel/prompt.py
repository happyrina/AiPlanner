import semantic_kernel as semantic_kernel
from semantic_kernel.connectors.ai.open_ai import OpenAITextCompletion

kernel = sk.Kernel()

kernel.add_text_completion_service(
  "OpenAI_davinci",
  OpenAITextCompletion(
    "text-davinci-003",
    "OPENAI_API_KEY=""
  )
)