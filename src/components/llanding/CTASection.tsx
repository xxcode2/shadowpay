import { motion } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-24 bg-card/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-8 shadow-glow">
            <Lock className="w-8 h-8 text-primary-foreground" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
            Ready to receive payments privately?
          </h2>

          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Join thousands using Privacy Cash to accept crypto payments without exposing their wallet.
          </p>

          <Link to="/create">
            <Button variant="hero" size="xl" className="group">
              <Lock className="w-5 h-5" />
              Create Your First Link
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>

          <p className="text-sm text-muted-foreground mt-6">
            No sign-up required • Completely non-custodial
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
