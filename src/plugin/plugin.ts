import { PLUGIN, UI } from "@common/networkSides";
import { PLUGIN_CHANNEL } from "@plugin/plugin.network";
import { Networker } from "monorepo-networker";

async function bootstrap() {
  Networker.initialize(PLUGIN, PLUGIN_CHANNEL);

  const uiOptions = {
    width: 900,
    height: 700,
    title: "Component DOM Extractor",
    themeColors: true,
  };

  if (figma.editorType === "figma") {
    figma.showUI(__html__, uiOptions);
  } else if (figma.editorType === "figjam") {
    figma.showUI(__html__, uiOptions);
  }

  console.log("Bootstrapped @", Networker.getCurrentSide().name);
}

bootstrap();
