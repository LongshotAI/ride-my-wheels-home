import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Clock, MapPin, Star, Bike } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-deedee.jpg";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image with Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/85 to-accent/70" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 py-20 text-center">
          <div className="animate-fade-up max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full mb-8 border border-white/20">
              <Bike className="w-5 h-5 text-accent" />
              <span className="text-primary-foreground font-medium">Bike-Based Designated Driver Service</span>
            </div>
            
            <h1 className="text-6xl md:text-8xl font-bold text-primary-foreground mb-6 leading-tight">
              Your Car. Your Driver.<br />
              <span className="bg-gradient-to-r from-accent to-success bg-clip-text text-transparent">
                DeeDee.
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-primary-foreground/90 mb-12 max-w-2xl mx-auto leading-relaxed">
              Safe rides home in your own car. Our vetted drivers bike to you, drive you home, then bike to the next gig. No surge pricing. No strangers' cars.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/auth?mode=signup&role=rider">
                <Button 
                  size="lg" 
                  className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-lg rounded-xl shadow-glow transition-all hover:scale-105"
                >
                  Book Your DeeDee <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/auth?mode=signup&role=driver">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="bg-white/10 hover:bg-white/20 text-primary-foreground border-white/30 font-semibold px-8 py-6 text-lg rounded-xl backdrop-blur-sm transition-all hover:scale-105"
                >
                  Drive with DeeDee
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-3 bg-white/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gradient-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-up">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Why Choose DeeDee?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The safest, most convenient way to get home after a night out
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: Shield,
                title: "Fully Vetted Drivers",
                description: "Every driver undergoes comprehensive background checks and vehicle experience verification before joining our platform.",
                color: "text-accent"
              },
              {
                icon: MapPin,
                title: "Your Car, Your Way Home",
                description: "No need to leave your car overnight or ride in a stranger's vehicle. Drive home in the comfort of your own car.",
                color: "text-success"
              },
              {
                icon: Clock,
                title: "Fast & Reliable",
                description: "Our bike-based model means drivers reach you quickly and efficiently. Track your driver in real-time on our live map.",
                color: "text-accent"
              },
              {
                icon: Star,
                title: "Transparent Pricing",
                description: "No surge pricing surprises. See your exact fare before booking and pay seamlessly through the app.",
                color: "text-success"
              },
              {
                icon: Bike,
                title: "Eco-Friendly Fleet",
                description: "Our drivers use bikes between rides, reducing carbon emissions while providing faster response times in urban areas.",
                color: "text-accent"
              },
              {
                icon: Shield,
                title: "Safety First",
                description: "In-app SOS button, ride tracking, emergency contacts, and 24/7 support ensure your safety throughout your journey.",
                color: "text-success"
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="bg-card rounded-2xl p-8 shadow-card hover:shadow-primary transition-all duration-300 hover:-translate-y-2 border border-border animate-scale-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br from-accent/10 to-success/10 mb-6`}>
                  <feature.icon className={`w-8 h-8 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold text-card-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              How DeeDee Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Getting home safely has never been easier
            </p>
          </div>
          
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8">
              {[
                { step: "1", title: "Request", desc: "Open the app, set your destination, and request a DeeDee" },
                { step: "2", title: "Match", desc: "We instantly connect you with a nearby vetted driver on a bike" },
                { step: "3", title: "Arrive", desc: "Your driver bikes to you, stows their bike, and takes the wheel" },
                { step: "4", title: "Home", desc: "Relax as you're driven home safely in your own car" }
              ].map((item, index) => (
                <div key={index} className="text-center animate-fade-up" style={{ animationDelay: `${index * 150}ms` }}>
                  <div className="w-16 h-16 rounded-full bg-gradient-accent flex items-center justify-center text-2xl font-bold text-accent-foreground mx-auto mb-4 shadow-glow">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,217,255,0.3),transparent_50%)]" />
        </div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
            Ready for a Safe Ride Home?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Join thousands of users who trust DeeDee for their designated driver needs
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth?mode=signup&role=rider">
              <Button 
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-lg rounded-xl shadow-glow transition-all hover:scale-105"
              >
                Get Started as a Rider
              </Button>
            </Link>
            <Link to="/auth?mode=signup&role=driver">
              <Button 
                size="lg"
                variant="outline"
                className="bg-white/10 hover:bg-white/20 text-primary-foreground border-white/30 font-semibold px-8 py-6 text-lg rounded-xl backdrop-blur-sm transition-all hover:scale-105"
              >
                Become a Driver
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary py-12 border-t border-primary-glow/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-bold text-primary-foreground mb-2">DeeDee</h3>
              <p className="text-primary-foreground/70">Your trusted designated driver service</p>
            </div>
            <div className="flex gap-6 text-sm text-primary-foreground/70">
              <a href="#" className="hover:text-primary-foreground transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-primary-foreground transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-primary-foreground transition-colors">Contact Us</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-primary-glow/20 text-center text-primary-foreground/50 text-sm">
            © 2025 DeeDee. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;