vim.opt.number = true
vim.opt.shortmess:append("I")

-- Bootstrap lazy.nvim if not already installed
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  vim.fn.system({
    "git", "clone", "--filter=blob:none", "--branch=stable",
    "https://github.com/folke/lazy.nvim.git", lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)  

-- Load and configure plugins
require("lazy").setup({
  {
    "catppuccin/nvim",
    name     = "catppuccin",
    lazy     = false,
    priority = 1000,
    config = function()
      vim.g.catppuccin_flavour = "macchiato"                  
      require("catppuccin").setup({ flavour = "macchiato" })       
      vim.cmd.colorscheme("catppuccin-macchiato")                  
    end,
  },
})
