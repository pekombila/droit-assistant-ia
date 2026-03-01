import { motion } from "framer-motion";

export const Greeting = () => {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="font-semibold text-3xl md:text-4xl"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.2 }}
      >
        Bienvenue sur Lexis.
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl text-lg text-zinc-500 md:text-xl"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.3 }}
      >
        Posez votre question sur le droit du travail, la protection sociale ou
        la fiscalité gabonaise.
      </motion.div>
    </div>
  );
};
